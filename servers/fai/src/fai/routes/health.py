from fastapi.responses import JSONResponse

from fai.app import fai_app


@fai_app.get("/health", openapi_extra={"x-fern-audiences": ["internal"]})
async def health_check() -> JSONResponse:
    """Health check endpoint that returns the application status."""
    return JSONResponse(content={"status": "hello fernie!"})
