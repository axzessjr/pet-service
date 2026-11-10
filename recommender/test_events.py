import json
import unittest

from events import handle_review_event
from db_test_support import PostgresTestCase


def message(**fields) -> bytes:
    event = {
        "reviewId": 1,
        "usageId": 1,
        "serviceId": 101,
        "rating": 5,
        "averageRating": 4.5,
        "reviewCount": 2,
        "version": 2,
        "occurredAt": "2026-10-13T00:00:00.000Z",
    }
    event.update(fields)
    return json.dumps(event).encode()


class ReviewEventTests(PostgresTestCase):
    def test_applies_event_and_ignores_redelivery(self):
        self.assertTrue(handle_review_event(self.store, message()))
        self.assertFalse(handle_review_event(self.store, message()))
        self.assertEqual(self.store.ratings(), {101: (4.5, 2)})

    def test_rejects_invalid_events(self):
        for body in (
            b"not json",
            b"[]",
            message(serviceId=0),
            message(serviceId="101"),
            message(version=True),
            message(averageRating=6),
            message(reviewCount=-1),
        ):
            with self.subTest(body=body), self.assertRaises(ValueError):
                handle_review_event(self.store, body)
        self.assertEqual(self.store.ratings(), {})


if __name__ == "__main__":
    unittest.main()
