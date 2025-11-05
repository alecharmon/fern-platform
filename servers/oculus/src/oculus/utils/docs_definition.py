import os

import requests


def get_docs_definition_for_domain(docs_domain: str) -> dict:
    response = requests.post(
        "https://registry.buildwithfern.com/v2/registry/docs/load-with-url",
        headers={"Authorization": f"Bearer {os.environ.get('FERN_TOKEN')}"},
        json={"url": docs_domain},
    )
    return response.json()
