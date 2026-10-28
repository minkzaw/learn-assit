import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from sqlalchemy import Column, Integer, String, Text, DateTime, text, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ── Settings ──────────────────────────────────────────────

class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str = "dev-secret"

    # Database
    db_user: str = "learnassist"
    db_password: str = "supersecret"
    db_name: str = "learnassist_db"
    db_host: str = "localhost"
    db_port: int = 5432

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def database_url_sync(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    class Config:
        env_file = ".env"


settings = Settings()


# ── Database Models ───────────────────────────────────────

class Base(DeclarativeBase):
    pass


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


# ── Engine & Session ──────────────────────────────────────

engine = create_async_engine(settings.database_url, echo=(settings.app_env == "development"))
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db(max_retries: int = 15, delay: float = 2.0):
    """Create tables on startup, retrying until the database is reachable."""
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database ready (attempt %d)", attempt)
            return
        except Exception as e:
            logger.warning("DB connection attempt %d/%d failed: %s", attempt, max_retries, e)
            if attempt == max_retries:
                raise
            await asyncio.sleep(delay)


async def close_db():
    """Dispose engine on shutdown."""
    await engine.dispose()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


# ── App ───────────────────────────────────────────────────

app = FastAPI(title="Learn Assist Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────

@app.get("/health")
async def health():
    # Check DB connectivity
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {"status": "ok", "database": db_status}


@app.get("/api/greet")
async def greet(name: str = "world"):
    return {
        "message": f"Hello {name} from [{settings.app_env}]",
    }


@app.get("/api/notes")
async def list_notes():
    """List all notes from PostgreSQL."""
    async with async_session() as session:
        result = await session.execute(select(Note).order_by(Note.id.desc()))
        notes = result.scalars().all()
        return [
            {"id": n.id, "title": n.title, "content": n.content, "created_at": str(n.created_at)}
            for n in notes
        ]


@app.post("/api/notes")
async def create_note(title: str, content: str = ""):
    """Create a new note in PostgreSQL."""
    async with async_session() as session:
        note = Note(title=title, content=content)
        session.add(note)
        await session.commit()
        await session.refresh(note)
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "created_at": str(note.created_at),
        }


@app.get("/")
async def root():
    return {"service": "learn-assist-backend", "version": "2.0.0"}
