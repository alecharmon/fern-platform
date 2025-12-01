from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from discord_bot.settings import VARIABLES

engine = create_async_engine(
    VARIABLES.POSTGRES_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=20,
    max_overflow=10,
)

async_session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
