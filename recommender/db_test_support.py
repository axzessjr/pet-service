"""Integration tests use an isolated schema, never the application's tables."""

import os
from pathlib import Path
import unittest
from uuid import uuid4

import psycopg
from psycopg import sql

from store import RecommendationStore


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "Set TEST_DATABASE_URL to run PostgreSQL integration tests")
class PostgresTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database_url = os.environ["TEST_DATABASE_URL"]
        cls.schema = "test_recommendation_" + uuid4().hex
        with psycopg.connect(cls.database_url, sslmode="require", prepare_threshold=None) as connection:
            connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(cls.schema)))
            ddl = (Path(__file__).resolve().parent.parent / "database" / "cloud.sql").read_text()
            # Generated schema has only letters, underscores and hexadecimal digits.
            connection.execute(ddl.replace("public.", f'"{cls.schema}".'), prepare=False)

    @classmethod
    def tearDownClass(cls):
        with psycopg.connect(cls.database_url, sslmode="require", prepare_threshold=None) as connection:
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(cls.schema)))

    def setUp(self):
        self.store = RecommendationStore(self.database_url, schema=self.schema)
        self.addCleanup(self.store.close)
        with self.store.pool.connection() as connection:
            connection.execute(sql.SQL("TRUNCATE {}.saved_recommendations, {}.service_ratings").format(
                sql.Identifier(self.schema), sql.Identifier(self.schema)
            ))
