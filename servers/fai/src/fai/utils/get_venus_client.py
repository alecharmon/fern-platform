from fern import AsyncFernVenusApi as VenusClient

from fai.settings import VARIABLES


def get_venus_client(token: str | None = None) -> VenusClient:
    return VenusClient(base_url=VARIABLES.VENUS_URL, token=token)
