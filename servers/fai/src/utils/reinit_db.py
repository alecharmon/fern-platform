import asyncio

from src.fai.db import (
    Base,
    engine,
)

# from src.fai.models.db.guidance_db import GuidanceDb
# from src.fai.models.db.document_db import DocumentDb
# from src.fai.models.db.query_db import QueryDb


async def reinit() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(reinit())
