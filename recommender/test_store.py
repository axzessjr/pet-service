import unittest
from contextlib import closing
import sqlite3
import tempfile
from pathlib import Path

from store import RecommendationStore
from db_test_support import PostgresTestCase
from migrate_sqlite import migrate


class RecommendationStoreTests(PostgresTestCase):
    def test_crud_persists_across_store_instances(self):
        store = self.store
        original = store.create(
            7, 5, [{"service_id": 101, "score": 0.8, "matched_needs": ["play"]}]
        )
        self.assertEqual(store.get(original["id"]), original)

        reopened = RecommendationStore(self.database_url, schema=self.schema)
        self.addCleanup(reopened.close)
        self.assertEqual(reopened.list_for_pet(7), [original])
        self.assertEqual(reopened.list_for_pet(8), [])

        updated = reopened.update(
            original["id"], 7, 2, [{"service_id": 102, "score": 1, "matched_needs": []}]
        )
        self.assertEqual(updated["id"], original["id"])
        self.assertEqual(updated["created_at"], original["created_at"])
        self.assertEqual(updated["limit"], 2)
        self.assertEqual(updated["matches"][0]["service_id"], 102)
        self.assertIsNone(reopened.update(original["id"], 8, 1, []))

        self.assertTrue(store.delete(original["id"]))
        self.assertIsNone(reopened.get(original["id"]))
        self.assertFalse(reopened.delete(original["id"]))

    def test_rating_keeps_newest_version(self):
        store = self.store
        self.assertEqual(store.ratings(), {})

        self.assertTrue(store.save_rating(101, 4.0, 1, 1))
        self.assertTrue(store.save_rating(101, 4.5, 2, 3))
        # A duplicate or late, older event is ignored.
        self.assertFalse(store.save_rating(101, 4.0, 1, 1))
        self.assertFalse(store.save_rating(101, 3.0, 3, 3))
        self.assertEqual(store.ratings(), {101: (4.5, 2)})

        # When every review is deleted, the service counts as unrated again.
        self.assertTrue(store.save_rating(101, 0, 0, 4))
        self.assertEqual(store.ratings(), {})

        # Real event versions are millisecond timestamps, larger than INTEGER.
        self.assertTrue(store.save_rating(101, 5, 1, 1_800_000_000_000))
        self.assertEqual(store.ratings(), {101: (5, 1)})

    def test_sqlite_import_is_repeatable_and_preserves_cloud_conflicts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'old.sqlite3'
            with closing(sqlite3.connect(path)) as source, source:
                source.executescript('''
                    CREATE TABLE saved_recommendations (
                        id TEXT, pet_id INTEGER, limit_value INTEGER,
                        matches_json TEXT, created_at TEXT, updated_at TEXT
                    );
                    CREATE TABLE service_ratings (
                        service_id INTEGER, average_rating REAL, review_count INTEGER,
                        version INTEGER, updated_at TEXT
                    );
                    INSERT INTO saved_recommendations VALUES (
                        'legacy-id', 7, 5, '[]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
                    );
                    INSERT INTO service_ratings VALUES (101, 4.5, 2, 1800000000000, '2026-01-01T00:00:00Z');
                ''')
            for _ in range(2):
                self.assertEqual(migrate(path, self.database_url, schema=self.schema), {
                    'saved_recommendations': 1, 'service_ratings': 1,
                })
                self.assertEqual(len(self.store.list_for_pet(7)), 1)
                self.assertEqual(self.store.ratings(), {101: (4.5, 2)})
            self.store.update('legacy-id', 7, 2, [])
            with self.assertRaisesRegex(ValueError, 'conflicts'):
                migrate(path, self.database_url, schema=self.schema)
            self.assertEqual(self.store.get('legacy-id')['limit'], 2)


if __name__ == "__main__":
    unittest.main()
