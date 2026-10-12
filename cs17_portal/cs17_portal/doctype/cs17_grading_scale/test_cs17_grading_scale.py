import frappe
from frappe.tests import IntegrationTestCase


class IntegrationTestCS17GradingScale(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.scale = frappe.get_doc(
			{
				"doctype": "CS17 Grading Scale",
				"scale_name": "Scale 160",
				"passing_percentage": 40,
				"bands": [
					{"grade": "E", "min_percent": 0, "max_percent": 39.99},
					{"grade": "D", "min_percent": 40, "max_percent": 54.99},
					{"grade": "C", "min_percent": 55, "max_percent": 69.99},
					{"grade": "B", "min_percent": 70, "max_percent": 84.99},
					{"grade": "A", "min_percent": 85, "max_percent": 100},
				],
			}
		).insert(ignore_permissions=True)

	def test_zero_percent_takes_the_lowest_band(self):
		self.assertEqual(self.scale.get_grade(0), "E")

	def test_percentage_on_a_band_minimum_takes_that_band(self):
		self.assertEqual(self.scale.get_grade(40), "D")

	def test_percentage_on_a_band_maximum_stays_in_that_band(self):
		self.assertEqual(self.scale.get_grade(39.99), "E")

	def test_hundred_percent_takes_the_highest_band(self):
		self.assertEqual(self.scale.get_grade(100), "A")

	def test_percentage_on_the_passing_mark_passes(self):
		self.assertTrue(self.scale.is_pass(40))

	def test_percentage_under_the_passing_mark_fails(self):
		self.assertFalse(self.scale.is_pass(39.99))
