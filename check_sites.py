import os
import requests
import sys
import time
import csv


# Check if there is an open test incident for this region
region = sys.argv[1]
other_region = "US"
if region == "US":
    other_region = "EU"
incident_name = f"Docs sites down"
token = os.environ['INCIDENT_API_KEY']
auth_header = {"Authorization": f"Bearer {token}"}
list_test_response = requests.get("https://api.incident.io/v2/incidents?page_size=250&mode%5Bone_of%5D=test", headers=auth_header)
if list_test_response.status_code != 200:
    print(list_test_response.json())
    sys.exit(f"Request failed with status code {list_test_response.status_code}")
# Look for one that matches our naming convention
test_incident_id = ''
test_incident_summary = ''
test_incident_sites_down = {"US": [], "EU": []}
for incident in list_test_response.json()["incidents"]:
    if incident["name"] == incident_name:
        incident_url = incident["permalink"]
        incident_category = incident["incident_status"]["category"]

        # skip if incident is declined, merged, cancelled, learning or closed
        print(f"Found incident {incident_url} of status {incident_category}")
        if incident_category in ["declined","merged","canceled","learning","closed"]:
            continue

        test_incident_id = incident["id"]
        test_incident_summary = incident["summary"]
        test_incident_sites_down["US"] = test_incident_summary.split("US Sites:\n\n- ")[1].split("\n\n\nEU Sites:\n\n- ")[0].split("\n\n- ")
        test_incident_sites_down["EU"] = test_incident_summary.split("US Sites:\n\n- ")[1].split("\n\n\nEU Sites:\n\n- ")[1].split("\n\n- ")
        if test_incident_sites_down["US"] == ['']:
            test_incident_sites_down["US"] = []
        if test_incident_sites_down["EU"] == ['']:
            test_incident_sites_down["EU"] = []
        print(f"Test incident '{incident["name"]}' (id:{test_incident_id}) exists. See: {incident_url}")
        break

# Check if there is an open 'standard' incident
list_response = requests.get("https://api.incident.io/v2/incidents?page_size=250", headers=auth_header)
if list_response.status_code != 200:
    print(list_response.json())
    sys.exit(f"Request failed with status code {list_response.status_code}")
# Look for one that matches our naming convention
incident_id = ''
incident_summary = ''
for incident in list_response.json()["incidents"]:
    if incident["name"] == incident_name:
        incident_url = incident["permalink"]
        incident_category = incident["incident_status"]["category"]

        # skip if incident is declined, merged, cancelled, learning or closed
        print(f"Found incident {incident_url} of status {incident_category}")
        if incident_category in ["declined","merged","canceled","learning","closed"]:
            continue

        incident_id = incident["id"]
        incident_summary = incident["summary"]
        print(f"Incident '{incident["name"]}' (id:{incident_id}) exists. See: {incident_url}")
        break

# Hit all sites to see if the are up
sites_down = {"US": [], "EU": []}
file = open('sites.csv', 'r')
reader = csv.reader(file, delimiter=',')
# Provide user agent header to hopefully avoid 403s
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
for row in reader:
    domain = row[0]
    try:
        resp = requests.get(f"https://{domain}", headers=headers)
    except:
        resp.status_code = 'request failed'
    if resp.status_code != 200:
        print(f"Issue getting {domain}")
        print(resp)
        sites_down[region].append(domain)


# If all sites are good, close any open test incidents 
if len(sites_down[region]) == 0:
    print("All sites appear to be OK")

    #If all sites are up in the other region and this region is now OK, close incident.
    if test_incident_id != '' and len(test_incident_sites_down[other_region])==0:
        print(f"All sites now appear to be up globally. Cancelling test incident.")
        # List of status IDs
        # Monitoring: 01HR85VFNXWH1H6976YCEJ5XJB
        # Declined: 01HR85VFNXG4ZXWCCFJ9NTJA6B
        # Cancelled: 01HR85VFNXMV8SBQ3FRPMDBCST
        # Closed: 01HR85VFNXJPF6TXWYTXA6NBS2
        edit_response = requests.post(f'https://api.incident.io/v2/incidents/{test_incident_id}/actions/edit', headers=auth_header, json={"incident": {"incident_status_id": "01HR85VFNXMV8SBQ3FRPMDBCST"},"notify_incident_channel": False})
        if edit_response.status_code != 200:
            print(edit_response.json())
            sys.exit(f"Request failed with status code {edit_response.status_code}")
        exit()

    # If there are still sites down in the other region, just update the sites for this region as being empty.
    if test_incident_id != '':
        print(f"All sites in {region} now appear to be up, but issues may still exist in {other_region}. Updating test incident.")
        sites_down[other_region]=test_incident_sites_down[other_region]
        edit_response = requests.post(f'https://api.incident.io/v2/incidents/{test_incident_id}/actions/edit', headers=auth_header, json={
            "incident": {
                "summary": f"The following sites are down as of {time.strftime('%l:%M%p %Z on %b %d, %Y')}.\n\n\nUS Sites:\n\n- {"\n\n- ".join(sites_down["US"])}\n\n\nEU Sites:\n\n- {"\n\n- ".join(sites_down["EU"])}"
            },
            "notify_incident_channel": False
        })
        if edit_response.status_code != 200:
            print(edit_response.json())
            sys.exit(f"Request failed with status code {edit_response.status_code}")
    exit()


# Check if this incident should be created/updated/escalated

# If no test or standard incident exists, create a new one
if test_incident_id == '' and incident_id == '':
    create_response = requests.post('https://api.incident.io/v2/incidents', headers=auth_header, json={
        "idempotency_key": f"{region}-{time.time()}",
        "name": incident_name,
        "incident_status_id": "01HR85VFNXWH1H6976YCEJ5XJB", # Monitoring
        "mode": "test",
        "severity_id": "01HR85VFNX9NYZG6B5Z40K8Y9V", # Minor
        "summary": f"The following sites are down as of {time.strftime('%l:%M%p %Z on %b %d, %Y')}.\n\n\nUS Sites:\n\n- {"\n\n- ".join(sites_down["US"])}\n\n\nEU Sites:\n\n- {"\n\n- ".join(sites_down["EU"])}",
        "visibility": "public"
        })
    if create_response.status_code != 200:
        print(create_response.json())
        sys.exit(f"Request failed with status code {create_response.status_code}")

    print("Incident created: ", create_response.json()["incident"]["permalink"])
    exit(1)

# If standard incident exists, leave it be
if incident_id != '':
    print("Standard incident already exists, see logs above")
    # TODO: Do we want to maintain this standard incident? Update site lists, auto-close, etc?
    exit(1)

# If test incident does exists, compare site list


# Look for any currently down sites that are still down
for currently_down_site in sites_down[region]:
    for previously_down_site in test_incident_sites_down[region]:
        # If sites have stayed down, convert incident from test -> standard
        if currently_down_site == previously_down_site:
            print("One or more previously down sites are still down, closing test incident and opening standard one.")
            edit_response = requests.post(f'https://api.incident.io/v2/incidents/{test_incident_id}/actions/edit', headers=auth_header, json={"incident": {"incident_status_id": "01HR85VFNXMV8SBQ3FRPMDBCST"},"notify_incident_channel": False})
            if edit_response.status_code != 200:
                print(edit_response.json())
                sys.exit(f"Request failed with status code {edit_response.status_code}")

            print("Test incident closed, opening standard incident")
            #Determine severity
            severity_id = "01HR85VFNX9NYZG6B5Z40K8Y9V" # Minor
            if len(sites_down[region])>10:
                severity_id = "01HR85VFNXA1RTYRR744G9FN6J" # Critical
            elif len(sites_down[region])>5:
                severity_id = "01HR85VFNXR6H5YPKJTE79YHG4" # Major
            sites_down[other_region]=test_incident_sites_down[other_region]
            create_response = requests.post('https://api.incident.io/v2/incidents', headers=auth_header, json={
                "idempotency_key": f"{region}-{time.time()}",
                "name": incident_name,
                "incident_status_id": "01HR85VFNXWH1H6976YCEJ5XJB", # Monitoring
                "severity_id": severity_id,
                "summary": f"The following sites are down as of {time.strftime('%l:%M%p %Z on %b %d, %Y')}.\n\n\nUS Sites:\n\n- {"\n\n- ".join(sites_down["US"])}\n\n\nEU Sites:\n\n- {"\n\n- ".join(sites_down["EU"])}",
                "visibility": "public"
                })
            if create_response.status_code != 200:
                print(create_response.json())
                sys.exit(f"Request failed with status code {create_response.status_code}")

            print("Incident created: ", create_response.json()["incident"]["permalink"])
            
            exit(1)


# Update test incident with new list
print("The list of sites down has changed. Updating the test incident to reflect the updated site list.")
sites_down[other_region]=test_incident_sites_down[other_region]
updated_json = {
    "incident": {
        "summary": f"The following sites are down as of {time.strftime('%l:%M%p %Z on %b %d, %Y')}.\n\n\nUS Sites:\n\n- {"\n\n- ".join(sites_down["US"])}\n\n\nEU Sites:\n\n- {"\n\n- ".join(sites_down["EU"])}"
    },
    "notify_incident_channel": False
}

# Apply updates
print("Applying Updates:")
print(updated_json)
edit_response = requests.post(f'https://api.incident.io/v2/incidents/{test_incident_id}/actions/edit', headers=auth_header, json=updated_json)
if edit_response.status_code != 200:
    print(edit_response.json())
    sys.exit(f"Request failed with status code {edit_response.status_code}")

exit(1)