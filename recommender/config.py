"""Load local credentials without copying them into another tracked file."""

import os
from pathlib import Path

from dotenv import load_dotenv


def load_environment() -> None:
    # Compose supplies these values directly. Native development reads the
    # shared root .env. Explicit process variables always take precedence.
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    os.environ.setdefault("RABBITMQ_URL", "amqp://pawpal:pawpal@localhost:5672")


def database_url() -> str:
    load_environment()
    value = os.getenv("DATABASE_URL", "")
    if not value:
        raise RuntimeError("Set DATABASE_URL in the root .env before starting the recommender")
    return value
