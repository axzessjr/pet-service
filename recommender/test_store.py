import unittest

from db_test_support import PostgresTestCase


class RatingStoreTests(PostgresTestCase):
    def test_rating_keeps_newest_version(self):
        store = self.store
        self.assertEqual(store.ratings([101]), {})

        self.assertTrue(store.save_rating(101, 4.0, 1, 1))
        self.assertTrue(store.save_rating(101, 4.5, 2, 3))
        # A duplicate or late, older event is ignored.
        self.assertFalse(store.save_rating(101, 4.0, 1, 1))
        self.assertFalse(store.save_rating(101, 3.0, 3, 3))
        self.assertEqual(store.ratings([101]), {101: (4.5, 2)})

        # When every review is deleted, the service counts as unrated again.
        self.assertTrue(store.save_rating(101, 0, 0, 4))
        self.assertEqual(store.ratings([101]), {})

        # Real event versions are millisecond timestamps, larger than INTEGER.
        self.assertTrue(store.save_rating(101, 5, 1, 1_800_000_000_000))
        self.assertEqual(store.ratings([101]), {101: (5, 1)})

    def test_ratings_returns_only_requested_services(self):
        self.store.save_rating(101, 4.0, 1, 1)
        self.store.save_rating(102, 3.0, 2, 1)
        self.assertEqual(self.store.ratings([102, 999]), {102: (3.0, 2)})
        self.assertEqual(self.store.ratings([]), {})


if __name__ == "__main__":
    unittest.main()
