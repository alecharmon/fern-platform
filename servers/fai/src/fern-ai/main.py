
import uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://www.app.buildwithfern.com",
        "https://app.buildwithfern.com",
        "https://www.app-dev.buildwithfern.com",
        "https://app-dev.buildwithfern.com",
        "https://www.dashboard-dev.buildwithfern.com",
        "https://dashboard-dev.buildwithfern.com",
        "https://www.dashboard.buildwithfern.com",
        "https://dashboard.buildwithfern.com",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> None:
    pass


def start() -> None:
    """Launched with `poetry run start` at root level"""

    uvicorn.run(
        "fern-ai.main:app", host="0.0.0.0", port=8080, server_header=False
    )


if __name__ == "__main__":
    start()
