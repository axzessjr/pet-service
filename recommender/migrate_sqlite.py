"""Copy a stopped stack's SQLite snapshot to PostgreSQL without deleting it."""

import argparse
from contextlib import closing
from datetime import datetime
import json
from pathlib import Path
import sqlite3

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
from psycopg.rows import dict_row

from config import database_url


def migrate(source_path: Path, url: str, *, schema: str = "public") -> dict:
    # mode=ro prevents a typo from silently creating an empty SQLite database.
    counts = {"saved_recommendations": 0, "service_ratings": 0}
    with closing(sqlite3.connect(source_path.resolve().as_uri() + "?mode=ro", uri=True)) as source:
        source.row_factory = sqlite3.Row
        with psycopg.connect(url, sslmode="require", prepare_threshold=None, row_factory=dict_row) as target:
            def execute(query, values=()):
                return target.execute(sql.SQL(query).format(schema=sql.Identifier(schema)), values)

            for row in source.execute("SELECT * FROM saved_recommendations"):
                matches = json.loads(row["matches_json"])
                created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                updated = datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
                execute(
                    "INSERT INTO {schema}.saved_recommendations "
                    "(id, pet_id, limit_value, matches_json, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    (row["id"], row["pet_id"], row["limit_value"], Jsonb(matches), created, updated),
                )
                copied = execute("SELECT * FROM {schema}.saved_recommendations WHERE id = %s", (row["id"],)).fetchone()
                if (copied["pet_id"], copied["limit_value"], copied["matches_json"], copied["created_at"], copied["updated_at"]) != (
                    row["pet_id"], row["limit_value"], matches, created, updated
                ):
                    raise ValueError("A cloud recommendation conflicts with the snapshot; migration rolled back")
                counts["saved_recommendations"] += 1

            for row in source.execute("SELECT * FROM service_ratings"):
                execute(
                    "INSERT INTO {schema}.service_ratings "
                    "(service_id, average_rating, review_count, version, updated_at) "
                    "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (service_id) DO UPDATE SET "
                    "average_rating = excluded.average_rating, review_count = excluded.review_count, "
                    "version = excluded.version, updated_at = excluded.updated_at "
                    "WHERE excluded.version > service_ratings.version",
                    (row["service_id"], row["average_rating"], row["review_count"], row["version"], row["updated_at"]),
                )
                copied = execute("SELECT * FROM {schema}.service_ratings WHERE service_id = %s", (row["service_id"],)).fetchone()
                if copied["version"] == row["version"] and (
                    copied["average_rating"], copied["review_count"]
                ) != (row["average_rating"], row["review_count"]):
                    raise ValueError("A rating version conflicts with the snapshot; migration rolled back")
                counts["service_ratings"] += 1
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Read-only SQLite snapshot to import")
    args = parser.parse_args()
    print(json.dumps(migrate(args.source, database_url())))
