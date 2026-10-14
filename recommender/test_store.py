import tempfile
import unittest
from pathlib import Path

from store import RecommendationStore


class RecommendationStoreTests(unittest.TestCase):
    def test_crud_persists_across_store_instances(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "recommendations.sqlite3")
            store = RecommendationStore(path)
            original = store.create(
                7, 5, [{"service_id": 101, "score": 0.8, "matched_needs": ["play"]}]
            )
            self.assertEqual(store.get(original["id"]), original)

            reopened = RecommendationStore(path)
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
        with tempfile.TemporaryDirectory() as directory:
            store = RecommendationStore(str(Path(directory) / "recommendations.sqlite3"))
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


if __name__ == "__main__":
    unittest.main()
