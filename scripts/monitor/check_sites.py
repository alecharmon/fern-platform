import csv
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx
from fern import IncidentEditPayloadV2, IncidentIO
from fern.core.api_error import ApiError

# Check if there is an open test incident for this region
region = sys.argv[1]
other_region = "US"
if region == "US":
    other_region = "EU"
incident_name = "Docs sites down"
token = os.environ["INCIDENT_API_KEY"]

# Initialize the Incident.io client with authentication
client = IncidentIO(headers={"Authorization": f"Bearer {token}"})

# Status IDs
STATUS_MONITORING = "01HR85VFNXWH1H6976YCEJ5XJB"
STATUS_CANCELLED = "01HR85VFNXMV8SBQ3FRPMDBCST"

# Severity IDs
SEVERITY_MINOR = "01HR85VFNX9NYZG6B5Z40K8Y9V"
SEVERITY_MAJOR = "01HR85VFNXR6H5YPKJTE79YHG4"
SEVERITY_CRITICAL = "01HR85VFNXA1RTYRR744G9FN6J"


def build_summary(sites_down: dict) -> str:
    timestamp = time.strftime("%l:%M%p %Z on %b %d, %Y")
    us_sites = "\n\n- ".join(sites_down["US"])
    eu_sites = "\n\n- ".join(sites_down["EU"])
    return f"The following sites are down as of {timestamp}.\n\n\nUS Sites:\n\n- {us_sites}\n\n\nEU Sites:\n\n- {eu_sites}"


def parse_sites_from_summary(summary: str) -> dict:
    sites_down = {"US": [], "EU": []}
    try:
        parts = summary.split("US Sites:\n\n- ")[1]
        us_part, eu_part = parts.split("\n\n\nEU Sites:\n\n- ")
        sites_down["US"] = us_part.split("\n\n- ")
        sites_down["EU"] = eu_part.split("\n\n- ")
        if sites_down["US"] == [""]:
            sites_down["US"] = []
        if sites_down["EU"] == [""]:
            sites_down["EU"] = []
    except (IndexError, ValueError):
        pass
    return sites_down


def list_test_incidents():
    try:
        response = client.incidents_v2.list(page_size=250, mode={"one_of": ["test"]})
        return response.incidents
    except ApiError as e:
        print(f"Error listing test incidents: {e.body}")
        sys.exit(f"Request failed with status code {e.status_code}")


def list_standard_incidents():
    try:
        response = client.incidents_v2.list(page_size=250)
        return response.incidents
    except ApiError as e:
        print(f"Error listing incidents: {e.body}")
        sys.exit(f"Request failed with status code {e.status_code}")


def edit_incident(incident_id: str, incident_status_id: str = None, summary: str = None):
    try:
        payload = IncidentEditPayloadV2(
            incident_status_id=incident_status_id,
            summary=summary,
        )
        client.incidents_v2.edit(
            id=incident_id, incident=payload, notify_incident_channel=False
        )
    except ApiError as e:
        print(f"Error editing incident: {e.body}")
        sys.exit(f"Request failed with status code {e.status_code}")


def create_incident(
    idempotency_key: str,
    name: str,
    summary: str,
    severity_id: str,
    mode: str = "test",
):
    try:
        response = client.incidents_v2.create(
            idempotency_key=idempotency_key,
            name=name,
            incident_status_id=STATUS_MONITORING,
            mode=mode,
            severity_id=severity_id,
            summary=summary,
            visibility="public",
        )
        return response.incident
    except ApiError as e:
        print(f"Error creating incident: {e.body}")
        sys.exit(f"Request failed with status code {e.status_code}")


# Find existing test incident
test_incident_id = ""
test_incident_sites_down = {"US": [], "EU": []}

# Track sites from incidents created within the last 24 hours (even if closed)
recent_incident_sites = {"US": set(), "EU": set()}
twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)

for incident in list_test_incidents():
    if incident.name == incident_name:
        incident_url = incident.permalink
        incident_category = incident.incident_status.category

        print(f"Found incident {incident_url} of status {incident_category}")

        # Track sites from recent incidents (within 24 hours) regardless of status
        if incident.created_at and incident.created_at >= twenty_four_hours_ago:
            recent_sites = parse_sites_from_summary(incident.summary or "")
            for site in recent_sites["US"]:
                recent_incident_sites["US"].add(site)
            for site in recent_sites["EU"]:
                recent_incident_sites["EU"].add(site)
            print(
                f"Found recent test incident (created {incident.created_at}), tracking its sites"
            )

        if incident_category in ["declined", "merged", "canceled", "learning", "closed"]:
            continue

        test_incident_id = incident.id
        test_incident_sites_down = parse_sites_from_summary(incident.summary or "")
        print(
            f"Test incident '{incident.name}' (id:{test_incident_id}) exists. See: {incident_url}"
        )
        break

# Find existing standard incident
incident_id = ""

for incident in list_standard_incidents():
    if incident.name == incident_name:
        incident_url = incident.permalink
        incident_category = incident.incident_status.category

        print(f"Found incident {incident_url} of status {incident_category}")

        # Track sites from recent incidents (within 24 hours) regardless of status
        if incident.created_at and incident.created_at >= twenty_four_hours_ago:
            recent_sites = parse_sites_from_summary(incident.summary or "")
            for site in recent_sites["US"]:
                recent_incident_sites["US"].add(site)
            for site in recent_sites["EU"]:
                recent_incident_sites["EU"].add(site)
            print(
                f"Found recent standard incident (created {incident.created_at}), tracking its sites"
            )

        if incident_category in ["declined", "merged", "canceled", "learning", "closed"]:
            continue

        incident_id = incident.id
        print(f"Incident '{incident.name}' (id:{incident_id}) exists. See: {incident_url}")
        break

# Hit all sites to see if they are up
sites_down = {"US": [], "EU": []}
FAST_TIMEOUT = 2  # seconds for first pass
RETRY_TIMEOUT = 15  # seconds for retry pass
slow_sites = []  # track sites that take longer than expected

# First, load all domains to get total count
with open("sites.csv", "r") as file:
    domains = [row[0] for row in csv.reader(file, delimiter=",") if row and row[0]]

total_sites = len(domains)
script_start_time = time.time()
print(f"\n=== Starting site checks for {region} region ({total_sites} sites) ===\n", flush=True)

http_headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}


def check_site_httpx(domain: str, timeout: int) -> tuple[bool, int, float, str]:
    """Check if a site is up using httpx. Returns (success, status_code, elapsed_time, error_msg)."""
    start_time = time.time()
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout) as client:
            resp = client.get(f"https://{domain}", headers=http_headers)
        elapsed = time.time() - start_time
        if resp.status_code == 200:
            return (True, resp.status_code, elapsed, "")
        else:
            return (False, resp.status_code, elapsed, f"status={resp.status_code}")
    except httpx.TimeoutException:
        elapsed = time.time() - start_time
        return (False, 0, elapsed, f"httpx timeout after {elapsed:.2f}s")
    except httpx.HTTPError as e:
        elapsed = time.time() - start_time
        return (False, 0, elapsed, f"httpx {type(e).__name__}")
    except Exception as e:
        elapsed = time.time() - start_time
        return (False, 0, elapsed, f"httpx unexpected: {type(e).__name__}")


# === PASS 1: Fast check with httpx ===
print(f"=== PASS 1: Fast check with httpx ({FAST_TIMEOUT}s timeout) ===", flush=True)
failed_domains = []

for i, domain in enumerate(domains, 1):
    if i % 25 == 0 or i == 1:
        elapsed_total = time.time() - script_start_time
        print(f"[{i}/{total_sites}] Pass 1... (elapsed: {elapsed_total:.1f}s)", flush=True)
    
    success, status, elapsed, error = check_site_httpx(domain, FAST_TIMEOUT)
    
    if success:
        if elapsed > 1:
            slow_sites.append((domain, elapsed, status))
    else:
        failed_domains.append(domain)
        print(f"  FAIL (pass 1): {domain} - {error}", flush=True)

pass1_elapsed = time.time() - script_start_time
print(f"\n=== Pass 1 complete: {len(failed_domains)} failures in {pass1_elapsed:.1f}s ===\n", flush=True)

# === PASS 2: Retry failed sites with httpx (longer timeout) ===
if failed_domains:
    print(f"=== PASS 2: Retrying {len(failed_domains)} failed sites with httpx ({RETRY_TIMEOUT}s timeout) ===", flush=True)
    still_failed = []
    
    for i, domain in enumerate(failed_domains, 1):
        print(f"  [{i}/{len(failed_domains)}] Retrying {domain}...", flush=True)
        
        success, status, elapsed, error = check_site_httpx(domain, RETRY_TIMEOUT)
        
        if success:
            print(f"    OK: {domain} succeeded on retry in {elapsed:.2f}s", flush=True)
            if elapsed > 2:
                slow_sites.append((domain, elapsed, status))
        else:
            print(f"    FAILED: {domain} - {error}", flush=True)
            sites_down[region].append(domain)

# Final summary
total_elapsed = time.time() - script_start_time
print(f"\n=== Site check complete: {total_sites} sites in {total_elapsed:.1f}s ===", flush=True)
print(f"Sites down: {len(sites_down[region])}", flush=True)

if slow_sites:
    print(f"\n=== SLOW SITES SUMMARY ({len(slow_sites)} sites took >1s) ===")
    for domain, elapsed, status in sorted(slow_sites, key=lambda x: -x[1]):
        print(f"  {domain}: {elapsed:.2f}s (status: {status})")


# If all sites are good, close any open test incidents
if len(sites_down[region]) == 0:
    print("All sites appear to be OK")

    # If all sites are up in the other region and this region is now OK, close incident.
    if test_incident_id != "" and len(test_incident_sites_down[other_region]) == 0:
        print("All sites now appear to be up globally. Cancelling test incident.")
        edit_incident(test_incident_id, incident_status_id=STATUS_CANCELLED)
        exit()

    # If there are still sites down in the other region, just update the sites for this region as being empty.
    if test_incident_id != "":
        print(
            f"All sites in {region} now appear to be up, but issues may still exist in {other_region}. Updating test incident."
        )
        sites_down[other_region] = test_incident_sites_down[other_region]
        edit_incident(test_incident_id, summary=build_summary(sites_down))
    exit()


# Check if this incident should be created/updated/escalated

# If no test or standard incident exists, check for recent incidents before creating
if test_incident_id == "" and incident_id == "":
    # Check if all currently down sites were in a recent incident (within 24 hours)
    all_sites_in_recent_incident = True
    for site in sites_down[region]:
        if site not in recent_incident_sites[region]:
            all_sites_in_recent_incident = False
            break

    if all_sites_in_recent_incident and len(sites_down[region]) > 0:
        print(
            f"All currently down sites were in a recent incident (within 24 hours). "
            f"Skipping incident creation to avoid re-opening for transient issues."
        )
        print(f"Sites down: {sites_down[region]}")
        print(f"Recent incident sites: {recent_incident_sites[region]}")
        exit()

    # Create new test incident for sites not covered by recent incidents
    incident = create_incident(
        idempotency_key=f"{region}-{time.time()}",
        name=incident_name,
        summary=build_summary(sites_down),
        severity_id=SEVERITY_MINOR,
        mode="test",
    )
    print("Incident created: ", incident.permalink)
    exit(1)

# If standard incident exists, leave it be
if incident_id != "":
    print("Standard incident already exists, see logs above")
    exit(1)

# If test incident does exist, compare site list

# Look for any currently down sites that are still down
for currently_down_site in sites_down[region]:
    for previously_down_site in test_incident_sites_down[region]:
        # If sites have stayed down, convert incident from test -> standard
        if currently_down_site == previously_down_site:
            print(
                "One or more previously down sites are still down, closing test incident and opening standard one."
            )
            edit_incident(test_incident_id, incident_status_id=STATUS_CANCELLED)

            print("Test incident closed, opening standard incident")
            # Determine severity
            severity_id = SEVERITY_MINOR
            if len(sites_down[region]) > 10:
                severity_id = SEVERITY_CRITICAL
            elif len(sites_down[region]) > 5:
                severity_id = SEVERITY_MAJOR
            sites_down[other_region] = test_incident_sites_down[other_region]
            incident = create_incident(
                idempotency_key=f"{region}-{time.time()}",
                name=incident_name,
                summary=build_summary(sites_down),
                severity_id=severity_id,
                mode="standard",
            )
            print("Incident created: ", incident.permalink)
            exit(1)


# Update test incident with new list
print(
    "The list of sites down has changed. Updating the test incident to reflect the updated site list."
)
sites_down[other_region] = test_incident_sites_down[other_region]
updated_summary = build_summary(sites_down)

# Apply updates
print("Applying Updates:")
print({"incident": {"summary": updated_summary}, "notify_incident_channel": False})
edit_incident(test_incident_id, summary=updated_summary)

exit(1)
