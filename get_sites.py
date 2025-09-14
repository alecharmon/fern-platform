import requests
import json
import sys
import os

# Get list of domains from vercel
teamID = os.environ['VERCEL_TEAM']
url = f"https://api.vercel.com/v10/projects/prod.ferndocs.com/domains?teamId={teamID}&limit=100&order=ASC"
token = os.environ['VERCEL_TOKEN']
done = False
project_domains = []
headers = {"Authorization": f"Bearer {token}"}

while not done:
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        sys.exit(f"Request failed with status code {response.status_code}")

    for domain in response.json()["domains"]:
        project_domains.append(domain["name"])

    # Deal with pagination
    next = response.json()["pagination"]["next"]
    if next is None:    
        done = True
    else:
        url = f"https://api.vercel.com/v10/projects/prod.ferndocs.com/domains?teamId={teamID}&limit=100&order=ASC&since={next}"

# Check if domains are properly configured
domains = []
misconfigured_domains = []
for domain in project_domains:
    domain_config_url = f"https://api.vercel.com/v6/domains/{domain}/config?teamId={teamID}"
    response = requests.get(domain_config_url, headers=headers)
    if response.status_code != 200:
        print(response.json())
        sys.exit(f"Request failed with status code {response.status_code}")

    #CHECK if properly configured
    if response.json()["misconfigured"]:
        print(f"{domain} is misconfigured and will be skipped")
        misconfigured_domains.append(domain)
        continue        
    domains.append(domain)


# Skip domains in the list below
skip_list = ["*.ferndocs.app","staging.ferndocs.com","twoslash.ferndocs.com","app.buildwithfern.com","app.ferndocs.com","canary.ferndocs.com","prod.ferndocs.com","fern-docs.skyflow.dev","docs.pinnacle.sh","docs.staging.paradex.trade","developers.ada.cx","developer.doc.spscommerce.com","next-remote.ferndocs.com","stable.ferndocs.com","experimental.ferndocs.com","docs.cloud.browser-use.com", "developers-beta.clearpay.co.uk"]

# Write domains out to file
print(f"Found {len(domains)} domains to check.")
with open('sites.csv', 'w') as myfile:
    for domain in domains:
        if domain in skip_list:
            print(f"Skipping {domain} as it is in the skip list.")
            continue
        myfile.write(f"{domain},\n")

    # Append additional sites
    print("Adding additional sites from additional_sites.csv")
    additional_domains = open('additional_sites.csv','r')
    myfile.write(additional_domains.read())
