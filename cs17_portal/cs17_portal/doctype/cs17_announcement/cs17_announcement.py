# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CS17Announcement(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		alert_variant: DF.Literal["info", "warning", "error"]
		cohort: DF.Link | None
		content: DF.MarkdownEditor
		is_dismissible: DF.Check
		is_published: DF.Check
		published_date: DF.Date | None
		title: DF.Data
	# end: auto-generated types

	def on_update(self):
		if self.is_published and self.has_value_changed("is_published"):
			self.send_announcement_email()

	def send_announcement_email(self):
		filters = {"user": ["is", "set"]}
		if self.cohort:
			filters.update({"cohort": self.cohort})

		users = frappe.get_all("CS17 Student", filters=filters, pluck="user")

		recipients = []
		if users:
			recipients = frappe.get_all(
				"User",
				filters={"name": ["in", users], "email": ["is", "set"]},
				pluck="email",
			)

		creator_email = frappe.db.get_value("User", self.owner, "email")
		if creator_email and creator_email not in recipients:
			recipients.append(creator_email)

		if not recipients:
			return

		frappe.sendmail(
			recipients=recipients,
			subject=self.title,
			message=frappe.utils.md_to_html(self.content),
		)
