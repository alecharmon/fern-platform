"""SQLAlchemy declarative base - separate from db.py to avoid circular imports and settings validation."""

from sqlalchemy.orm import declarative_base

Base = declarative_base()
