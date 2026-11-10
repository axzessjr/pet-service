"""PostgreSQL persistence for recommendations and versioned review ratings."""

from datetime import datetime, timezone
from uuid import uuid4

from psycopg.rows import dict_row
from psycopg import sql
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool


def _timestamp() -> datetime:
    return datetime.now(timezone.utc)


class RecommendationStore:
    def __init__(self, database_url: str, *, schema: str = "public"):
        if not database_url:
            raise ValueError("DATABASE_URL is required; run backend's npm run db:migrate first")
        self.schema = schema
        self.pool = ConnectionPool(
            database_url,
            min_size=1,
            max_size=6,
            timeout=5,
            kwargs={
                "row_factory": dict_row,
                "connect_timeout": 10,
                "sslmode": "require",
                # Supabase's transaction pooler does not support prepared statements.
                "prepare_threshold": None,
            },
            open=True,
        )
        try:
            self.pool.wait(timeout=15)
            with self.pool.connection() as connection:
                self._execute(connection, "SELECT id FROM {schema}.saved_recommendations LIMIT 0")
                self._execute(connection, "SELECT service_id FROM {schema}.service_ratings LIMIT 0")
        except Exception:
            self.pool.close()
            raise

    def close(self) -> None:
        self.pool.close()

    def _execute(self, connection, query: str, parameters=()):
        return connection.execute(
            sql.SQL(query).format(schema=sql.Identifier(self.schema)), parameters
        )

    @staticmethod
    def _record(row: dict) -> dict:
        def timestamp(value: datetime) -> str:
            return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

        return {
            "id": row["id"],
            "pet_id": row["pet_id"],
            "limit": row["limit_value"],
            "matches": row["matches_json"],
            "created_at": timestamp(row["created_at"]),
            "updated_at": timestamp(row["updated_at"]),
        }

    def create(self, pet_id: int, limit: int, matches: list[dict]) -> dict:
        now = _timestamp()
        with self.pool.connection() as connection:
            row = self._execute(connection,
                "INSERT INTO {schema}.saved_recommendations "
                "(id, pet_id, limit_value, matches_json, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING *",
                (str(uuid4()), pet_id, limit, Jsonb(matches), now, now),
            ).fetchone()
        return self._record(row)

    def get(self, record_id: str) -> dict | None:
        with self.pool.connection() as connection:
            row = self._execute(connection,
                "SELECT * FROM {schema}.saved_recommendations WHERE id = %s", (record_id,)
            ).fetchone()
        return self._record(row) if row else None

    def list_for_pet(self, pet_id: int) -> list[dict]:
        with self.pool.connection() as connection:
            rows = self._execute(connection,
                "SELECT * FROM {schema}.saved_recommendations WHERE pet_id = %s "
                "ORDER BY created_at DESC, id DESC", (pet_id,)
            ).fetchall()
        return [self._record(row) for row in rows]

    def update(self, record_id: str, pet_id: int, limit: int, matches: list[dict]) -> dict | None:
        with self.pool.connection() as connection:
            row = self._execute(connection,
                "UPDATE {schema}.saved_recommendations SET limit_value = %s, matches_json = %s, "
                "updated_at = %s WHERE id = %s AND pet_id = %s RETURNING *",
                (limit, Jsonb(matches), _timestamp(), record_id, pet_id),
            ).fetchone()
        return self._record(row) if row else None

    def delete(self, record_id: str) -> bool:
        with self.pool.connection() as connection:
            result = self._execute(connection,
                "DELETE FROM {schema}.saved_recommendations WHERE id = %s", (record_id,)
            )
            return result.rowcount > 0

    def save_rating(self, service_id: int, average_rating: float, review_count: int, version: int) -> bool:
        """Atomically ignore duplicates and older events, even with concurrent consumers."""
        with self.pool.connection() as connection:
            result = self._execute(connection,
                "INSERT INTO {schema}.service_ratings "
                "(service_id, average_rating, review_count, version, updated_at) "
                "VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (service_id) DO UPDATE SET "
                "average_rating = excluded.average_rating, review_count = excluded.review_count, "
                "version = excluded.version, updated_at = excluded.updated_at "
                "WHERE excluded.version > service_ratings.version",
                (service_id, average_rating, review_count, version, _timestamp()),
            )
            return result.rowcount > 0

    def ratings(self) -> dict[int, tuple[float, int]]:
        with self.pool.connection() as connection:
            rows = self._execute(connection,
                "SELECT service_id, average_rating, review_count "
                "FROM {schema}.service_ratings WHERE review_count > 0"
            ).fetchall()
        return {row["service_id"]: (row["average_rating"], row["review_count"]) for row in rows}
