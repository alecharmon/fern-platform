from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
)
from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
)

from src.settings import VARIABLES

engine = create_async_engine(VARIABLES.POSTGRES_DATABASE_URL, echo=True, pool_pre_ping=True, pool_recycle=1800)

async_session_maker = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()
