import asyncio

from src.fai.db import Base
from src.fai.db import engine


# from src.fai.models.db.guidance import Guidance
# from src.fai.models.db.query import Query


async def reinit() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(reinit())
