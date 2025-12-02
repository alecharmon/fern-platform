#!/usr/bin/env python3
"""
Script to delete records from query namespaces where source is not in the valid sources list.

This script:
1. Pulls all unique domains from the settings table
2. Checks each domain's query namespace for records with invalid sources
3. Optionally deletes those records (dry-run mode by default)

Valid sources: fern_docs, document, guidance, slack_context, website, code

Usage:
    # Dry run (default) - show what would be deleted
    poetry run python scripts/cleanup_query_index.py

    # Actually delete the records
    poetry run python scripts/cleanup_query_index.py --delete
"""

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from sqlalchemy import select  # noqa: E402
from turbopuffer import AsyncTurbopuffer  # noqa: E402

from fai.db import async_session_maker  # noqa: E402
from fai.models.db.settings_db import SettingsDb  # noqa: E402
from fai.models.enums.index_names import DataIndexNames  # noqa: E402
from fai.settings import (  # noqa: E402
    CONFIG,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import (  # noqa: E402
    get_query_index_name,
    get_tpuf_namespace,
)

VALID_SOURCES = [source.value for source in DataIndexNames]


@dataclass
class NamespaceResult:
    domain: str
    namespace: str
    exists: bool
    total_invalid_records: int
    invalid_sources: dict[str, int]
    deleted: bool


async def get_all_domains() -> list[str]:
    async with async_session_maker() as db:
        result = await db.execute(select(SettingsDb.domain))
        return [row[0] for row in result.all()]


async def check_namespace_for_invalid_sources(
    tpuf_client: AsyncTurbopuffer, domain: str, dry_run: bool
) -> NamespaceResult | None:
    namespace_id = get_tpuf_namespace(domain, get_query_index_name())
    ns = tpuf_client.namespace(namespace_id)

    ns_exists = await ns.exists()
    if not ns_exists:
        return NamespaceResult(
            domain=domain,
            namespace=namespace_id,
            exists=False,
            total_invalid_records=0,
            invalid_sources={},
            deleted=False,
        )

    invalid_sources: dict[str, int] = {}
    total_invalid = 0
    last_id: str | None = None

    while True:
        filters: Any = ["source", "NotIn", VALID_SOURCES]
        if last_id is not None:
            filters = ["And", [filters, ["id", "Gt", last_id]]]

        result = await ns.query(
            top_k=1200,
            include_attributes=True,
            filters=filters,
        )

        for row in result.rows:
            source = row.model_extra.get("source", "unknown") if hasattr(row, "model_extra") else "unknown"
            invalid_sources[source] = invalid_sources.get(source, 0) + 1
            total_invalid += 1

        if len(result.rows) < 1200:
            break
        last_id = result.rows[-1].id

    deleted = False
    if total_invalid > 0 and not dry_run:
        await ns.write(delete_by_filter=["source", "NotIn", VALID_SOURCES])
        deleted = True

    return NamespaceResult(
        domain=domain,
        namespace=namespace_id,
        exists=True,
        total_invalid_records=total_invalid,
        invalid_sources=invalid_sources,
        deleted=deleted,
    )


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete records from query namespaces where source is not in the valid sources list"
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Actually delete the records (default is dry-run mode)",
    )
    parser.add_argument(
        "--domain",
        type=str,
        help="Process only a specific domain (optional)",
    )
    args = parser.parse_args()

    dry_run = not args.delete

    print(f"\n{'='*80}")
    print("Delete Invalid Source Records from Query Namespaces")
    print(f"{'='*80}")
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'DELETE MODE'}")
    print(f"Valid sources: {', '.join(VALID_SOURCES)}")
    print(f"{'='*80}\n")

    if args.domain:
        domains = [args.domain]
        print(f"Processing single domain: {args.domain}")
    else:
        print("Fetching all domains from settings table...")
        try:
            domains = await get_all_domains()
            print(f"Found {len(domains)} domains\n")
        except Exception as e:
            print(f"Failed to connect to database: {e}")
            print("Use --domain <domain> to test a specific domain without DB access")
            return

    if not domains:
        print("No domains found. Exiting.")
        return

    results: list[NamespaceResult] = []

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        for i, domain in enumerate(domains, 1):
            print(f"[{i}/{len(domains)}] Processing: {domain}...", end=" ", flush=True)

            try:
                result = await check_namespace_for_invalid_sources(tpuf_client, domain, dry_run)
                if result:
                    results.append(result)
                    if not result.exists:
                        print("namespace does not exist")
                    elif result.total_invalid_records == 0:
                        print("no invalid records")
                    else:
                        status = "DELETED" if result.deleted else "found"
                        print(f"{result.total_invalid_records} invalid records {status}")
            except Exception as e:
                print(f"ERROR: {e}")

    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")

    namespaces_with_issues = [r for r in results if r.total_invalid_records > 0]
    namespaces_not_exist = [r for r in results if not r.exists]
    namespaces_clean = [r for r in results if r.exists and r.total_invalid_records == 0]

    print(f"\nTotal domains processed: {len(results)}")
    print(f"  - Namespaces with invalid records: {len(namespaces_with_issues)}")
    print(f"  - Namespaces without issues: {len(namespaces_clean)}")
    print(f"  - Namespaces that don't exist: {len(namespaces_not_exist)}")

    if namespaces_with_issues:
        total_invalid = sum(r.total_invalid_records for r in namespaces_with_issues)
        print(f"\nTotal invalid records across all namespaces: {total_invalid}")

        all_invalid_sources: dict[str, int] = {}
        for r in namespaces_with_issues:
            for source, count in r.invalid_sources.items():
                all_invalid_sources[source] = all_invalid_sources.get(source, 0) + count

        print("\nInvalid sources breakdown:")
        for source, count in sorted(all_invalid_sources.items(), key=lambda x: -x[1]):
            print(f"  - {source}: {count} records")

        print("\nNamespaces with invalid records:")
        for r in sorted(namespaces_with_issues, key=lambda x: -x.total_invalid_records):
            status = "[DELETED]" if r.deleted else "[would delete]"
            print(f"  {status} {r.domain}: {r.total_invalid_records} records")
            for source, count in sorted(r.invalid_sources.items(), key=lambda x: -x[1]):
                print(f"      - {source}: {count}")

        sorted_issues = sorted(namespaces_with_issues, key=lambda x: -x.total_invalid_records)
        max_domain_len = max(len(r.domain) for r in sorted_issues)
        max_domain_len = max(max_domain_len, len("Domain"))

        print(f"\n{'─'*80}")
        print("DOMAINS WITH INVALID RECORDS")
        print(f"{'─'*80}")
        header = f"{'Domain':<{max_domain_len}}  │ {'Records':>8} │ {'Status':<10} │ Invalid Sources"
        print(header)
        print(f"{'─'*max_domain_len}──┼{'─'*10}┼{'─'*12}┼{'─'*30}")
        for r in sorted_issues:
            status = "DELETED" if r.deleted else "pending"
            sources_str = ", ".join(f"{s}({c})" for s, c in sorted(r.invalid_sources.items(), key=lambda x: -x[1]))
            print(f"{r.domain:<{max_domain_len}}  │ {r.total_invalid_records:>8} │ {status:<10} │ {sources_str}")
        print(f"{'─'*80}")

        if dry_run:
            print(f"\n{'='*80}")
            print("DRY RUN COMPLETE - No changes were made")
            print("Run with --delete to actually remove these records")
            print(f"{'='*80}")
        else:
            deleted_count = sum(r.total_invalid_records for r in namespaces_with_issues if r.deleted)
            print(f"\n{'='*80}")
            print(f"DELETION COMPLETE - {deleted_count} records deleted")
            print(f"{'='*80}")
    else:
        print("\n✓ All namespaces are clean - no invalid source records found!")

    print()


if __name__ == "__main__":
    asyncio.run(main())
