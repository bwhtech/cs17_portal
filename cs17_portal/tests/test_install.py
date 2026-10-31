# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal.install import allow_submission_files


class TestInstall(FrappeTestCase):
	def test_adds_submission_file_types_to_a_restricted_extension_list(self):
		frappe.db.set_single_value("System Settings", "allowed_file_extensions", "PDF\nPNG\nZIP")

		allow_submission_files()

		self.assertEqual(
			frappe.db.get_single_value("System Settings", "allowed_file_extensions"),
			"PDF\nPNG\nZIP\nSB3\nGZ\nTGZ\nGIF\nWEBP\nWEBM\nOGG\nM4A",
		)
