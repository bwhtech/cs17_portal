# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import escape_html


class CS17Feedback(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		category: DF.Literal["Food", "Stay", "Other"]
		cohort: DF.Link | None
		description: DF.SmallText | None
		voice_note: DF.Attach | None
	# end: auto-generated types

	def after_insert(self):
		frappe.enqueue(create_helpdesk_ticket, feedback=self.name, enqueue_after_commit=True)


def create_helpdesk_ticket(feedback: str) -> None:
	frappe.set_user("Administrator")  # nosemgrep
	doc = frappe.get_doc("CS17 Feedback", feedback)
	description = escape_html(doc.description or "")
	if doc.voice_note:
		description += f"<p>Voice note attached to {doc.name}.</p>"
	frappe.get_doc(
		{
			"doctype": "HD Ticket",
			"subject": f"{doc.category} feedback ({doc.name})",
			"description": description,
		}
	).insert()
