"""PostgreSQL persistence for versioned review ratings."""

from collections.abc import Collection

from psycopg.rows import dict_row
from psycopg import sql
from psycopg_pool import ConnectionPool


class RatingStore:
    """Average review ratings per service, kept up to date by review events."""

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

    def save_rating(self, service_id: int, average_rating: float, review_count: int, version: int) -> bool:
        """Atomically ignore duplicates and older events, even with concurrent consumers."""
        with self.pool.connection() as connection:
            result = self._execute(connection,
                "INSERT INTO {schema}.service_ratings "
                "(service_id, average_rating, review_count, version, updated_at) "
                "VALUES (%s, %s, %s, %s, now()) "
                "ON CONFLICT (service_id) DO UPDATE SET "
                "average_rating = excluded.average_rating, review_count = excluded.review_count, "
                "version = excluded.version, updated_at = excluded.updated_at "
                "WHERE excluded.version > service_ratings.version",
                (service_id, average_rating, review_count, version),
            )
            return result.rowcount > 0

    def ratings(self, service_ids: Collection[int]) -> dict[int, tuple[float, int]]:
        """Return (average, count) for the given services that have reviews."""
        if not service_ids:
            return {}
        with self.pool.connection() as connection:
            rows = self._execute(connection,
                "SELECT service_id, average_rating, review_count "
                "FROM {schema}.service_ratings "
                "WHERE review_count > 0 AND service_id = ANY(%s)",
                (list(service_ids),),
            ).fetchall()
        return {row["service_id"]: (row["average_rating"], row["review_count"]) for row in rows}
