import unittest

from engine import Pet, Service, recommend


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.services = [
            Service(1, ("cat",), ("coat-care", "low-stress"), 40),
            Service(2, ("dog",), ("exercise", "social"), 20),
            Service(3, ("cat",), ("play",), 20),
            Service(4, ("cat",), ("coat-care",), 60),
        ]

    def test_matches_needs_and_filters_species_and_budget(self):
        matches = recommend(Pet("cat", ("coat-care", "low-stress"), 50), self.services, 5)
        self.assertEqual([match.service_id for match in matches], [1])
        self.assertEqual(matches[0].matched_needs, ("coat-care", "low-stress"))
        self.assertAlmostEqual(matches[0].score, 1.0)

    def test_fallback_without_needs_uses_cheapest_eligible(self):
        matches = recommend(Pet("cat", (), 50), self.services, 2)
        self.assertEqual([match.service_id for match in matches], [3, 1])

    def test_empty_and_non_positive_limit(self):
        self.assertEqual(recommend(Pet("bird", ("play",), 50), self.services, 5), [])
        self.assertEqual(recommend(Pet("cat", ("play",), 50), self.services, 0), [])


if __name__ == "__main__":
    unittest.main()
