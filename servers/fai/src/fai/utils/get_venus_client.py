from fern import AsyncFernVenusApi as VenusClient


def get_venus_client(token: str | None = None) -> VenusClient:
    return VenusClient(token=token)
