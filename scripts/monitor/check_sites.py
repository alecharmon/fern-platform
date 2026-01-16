import csv
import os
import sys
import time

import requests
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

for incident in list_test_incidents():
    if incident.name == incident_name:
        incident_url = incident.permalink
        incident_category = incident.incident_status.category

        print(f"Found incident {incident_url} of status {incident_category}")
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
        if incident_category in ["declined", "merged", "canceled", "learning", "closed"]:
            continue

        incident_id = incident.id
        print(f"Incident '{incident.name}' (id:{incident_id}) exists. See: {incident_url}")
        break

# Hit all sites to see if they are up
sites_down = {"US": [], "EU": []}
with open("sites.csv", "r") as file:
    reader = csv.reader(file, delimiter=",")
    http_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    for row in reader:
        domain = row[0]
        try:
            resp = requests.get(f"https://{domain}", headers=http_headers)
            if resp.status_code != 200:
                print(f"Issue getting {domain}")
                print(resp)
                sites_down[region].append(domain)
        except Exception:
            print(f"Issue getting {domain}")
            sites_down[region].append(domain)


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

# If no test or standard incident exists, create a new one
if test_incident_id == "" and incident_id == "":
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
