"""SQLite persistence for saved recommendation sets."""

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class RecommendationStore:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS saved_recommendations (
                    id TEXT PRIMARY KEY,
                    pet_id INTEGER NOT NULL,
                    limit_value INTEGER NOT NULL,
                    matches_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS saved_recommendations_pet_id "
                "ON saved_recommendations (pet_id, created_at DESC)"
            )
            # Copy of each service's rating totals, kept current by review
            # events from the usage and review service.
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS service_ratings (
                    service_id INTEGER PRIMARY KEY,
                    average_rating REAL NOT NULL,
                    review_count INTEGER NOT NULL,
                    version INTEGER NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _record(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "pet_id": row["pet_id"],
            "limit": row["limit_value"],
            "matches": json.loads(row["matches_json"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def create(self, pet_id: int, limit: int, matches: list[dict]) -> dict:
        record_id = str(uuid4())
        now = _timestamp()
        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO saved_recommendations "
                "(id, pet_id, limit_value, matches_json, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (record_id, pet_id, limit, json.dumps(matches), now, now),
            )
        return self.get(record_id)

    def get(self, record_id: str) -> dict | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM saved_recommendations WHERE id = ?", (record_id,)
            ).fetchone()
        return self._record(row) if row else None

    def list_for_pet(self, pet_id: int) -> list[dict]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT * FROM saved_recommendations WHERE pet_id = ? "
                "ORDER BY created_at DESC, id DESC",
                (pet_id,),
            ).fetchall()
        return [self._record(row) for row in rows]

    def update(self, record_id: str, pet_id: int, limit: int, matches: list[dict]) -> dict | None:
        with closing(self._connect()) as connection, connection:
            result = connection.execute(
                "UPDATE saved_recommendations SET limit_value = ?, matches_json = ?, "
                "updated_at = ? WHERE id = ? AND pet_id = ?",
                (limit, json.dumps(matches), _timestamp(), record_id, pet_id),
            )
            if result.rowcount == 0:
                return None
        return self.get(record_id)

    def delete(self, record_id: str) -> bool:
        with closing(self._connect()) as connection, connection:
            result = connection.execute(
                "DELETE FROM saved_recommendations WHERE id = ?", (record_id,)
            )
            return result.rowcount > 0

    def save_rating(
        self, service_id: int, average_rating: float, review_count: int, version: int
    ) -> bool:
        """Store a service's totals unless an equal or newer version is already saved.

        Events can arrive twice or out of order, so the version check keeps
        the newest totals. Returns False when the event was stale.
        """
        with closing(self._connect()) as connection, connection:
            result = connection.execute(
                "INSERT INTO service_ratings "
                "(service_id, average_rating, review_count, version, updated_at) "
                "VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT (service_id) DO UPDATE SET "
                "average_rating = excluded.average_rating, "
                "review_count = excluded.review_count, "
                "version = excluded.version, "
                "updated_at = excluded.updated_at "
                "WHERE excluded.version > service_ratings.version",
                (service_id, average_rating, review_count, version, _timestamp()),
            )
            return result.rowcount > 0

    def ratings(self) -> dict[int, tuple[float, int]]:
        """Map service ID to (average rating, review count) for reviewed services."""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT service_id, average_rating, review_count "
                "FROM service_ratings WHERE review_count > 0"
            ).fetchall()
        return {
            row["service_id"]: (row["average_rating"], row["review_count"])
            for row in rows
        }
