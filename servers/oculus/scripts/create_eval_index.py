"""TPUF_API_KEY=<key> poetry run python scripts/create_eval_index.py <source_namespace_name> <eval_index>"""

import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv
from fai.utils.turbopuffer.schemas import get_query_index_tpuf_schema
from turbopuffer import (
    NOT_GIVEN,
    AsyncTurbopuffer,
)

load_dotenv()


async def create_eval_index(source_domain: str, eval_index: str, api_key: str) -> int:
    tpuf_client = None
    try:
        tpuf_client = AsyncTurbopuffer(
            region="gcp-us-east4",
            api_key=api_key,
        )

        source_namespace = tpuf_client.namespace(f"{source_domain}_query")
        dest_namespace = tpuf_client.namespace(f"{eval_index}_query")

        source_ns_exists = await source_namespace.exists()
        if not source_ns_exists:
            raise Exception(f"No source domain query index found.")

        try:
            await dest_namespace.delete_all()
            print(f"Deleted all documents from {dest_namespace.id}")
        except Exception:
            print(f"No documents to delete from {dest_namespace.id}")

        last_id = None
        while True:
            print(f"Querying {source_namespace.id} for more documents...")
            result = await source_namespace.query(
                rank_by=("id", "asc"),
                top_k=1000,
                include_attributes=True,
                filters=("id", "Gt", last_id) if last_id is not None else NOT_GIVEN,
            )

            print(f"Writing {len(result.rows)} documents to {dest_namespace.id}")
            await dest_namespace.write(
                upsert_rows=result.rows, distance_metric="cosine_distance", schema=get_query_index_tpuf_schema()
            )

            if len(result.rows) < 1000:
                break
            last_id = result.rows[-1].id

        print(f"Successfully copied {last_id} documents from {source_namespace.id} to {dest_namespace.id}")
        return 0

    except Exception as e:
        raise Exception(f"Error: {e}")
    finally:
        if tpuf_client is not None:
            await tpuf_client.close()


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create evaluation index using turbopuffer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  TPUF_API_KEY=abc123 poetry run python scripts/create_eval_index.py prod-domain eval-domain
  TPUF_API_KEY=abc123 poetry run python scripts/create_eval_index.py buildwithfern.com eval-buildwithfern
        """,
    )

    parser.add_argument(
        "source_domain",
        type=str,
        help="Source domain to copy data from"
    )

    parser.add_argument(
        "eval_index",
        type=str,
        help="Destination index for evaluation"
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()
    api_key = os.getenv("TPUF_API_KEY")
    if not api_key:
        raise Exception("TPUF_API_KEY environment variable is not set")

    return await create_eval_index(
        source_domain=args.source_domain,
        eval_index=args.eval_index,
        api_key=api_key,
    )


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
