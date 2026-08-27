from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from src.config import DATABASE_URL
from src.database.base import Base

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            DATABASE_URL,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        _SessionLocal = sessionmaker(
            bind=_engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            future=True,
        )
    return _engine


def get_session() -> Session:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Create tables when migrations have not been applied yet (local/dev)."""
    # Import models so metadata is populated.
    from src.database import models  # noqa: F401

    engine = get_engine()
    if DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)


def probe_database() -> tuple[bool, str]:
    try:
        engine = get_engine()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        dialect = engine.dialect.name
        return True, f"{dialect} connected"
    except Exception as error:
        return False, f"{type(error).__name__}: {error}"
