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

    def test_rating_breaks_score_ties_before_price(self):
        services = [
            Service(10, ("dog",), ("exercise",), 20),
            Service(11, ("dog",), ("exercise",), 30),
            Service(12, ("dog",), ("exercise",), 40),
        ]
        pet = Pet("dog", ("exercise",), 0)
        self.assertEqual([m.service_id for m in recommend(pet, services, 5)], [10, 11, 12])

        # 12 is well rated, 10 is poorly rated, and unrated 11 counts as neutral (3.0).
        ranked = recommend(pet, services, 5, {10: 2.0, 12: 4.5})
        self.assertEqual([m.service_id for m in ranked], [12, 11, 10])

    def test_rating_does_not_outrank_better_tag_match(self):
        services = [
            Service(20, ("dog",), ("exercise", "social"), 30),
            Service(21, ("dog",), ("exercise", "outdoors"), 30),
        ]
        ranked = recommend(Pet("dog", ("exercise", "social"), 0), services, 5, {21: 5.0})
        self.assertEqual([m.service_id for m in ranked], [20, 21])

    def test_fallback_without_needs_prefers_rating_then_price(self):
        matches = recommend(Pet("cat", (), 50), self.services, 2, {1: 4.0})
        self.assertEqual([match.service_id for match in matches], [1, 3])

    def test_empty_and_non_positive_limit(self):
        self.assertEqual(recommend(Pet("bird", ("play",), 50), self.services, 5), [])
        self.assertEqual(recommend(Pet("cat", ("play",), 50), self.services, 0), [])


if __name__ == "__main__":
    unittest.main()
