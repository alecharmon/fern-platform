import asyncio

from fai.db_models.document import Document
from src.fai.db import Base
from src.fai.db import engine
from src.fai.db_models.query import Query


async def init() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(init())
