# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class CS17AISettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		api_key: DF.Password | None
		model: DF.Data | None
		other_models: DF.SmallText | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 AI Settings"

	def validate(self):
		for model in self.models():
			provider, _slash, name = model.partition("/")
			if not (provider and name):
				frappe.throw(_("Enter each model as provider/model, for example gemini/gemini-3.5-flash."))

	def is_set_up(self) -> bool:
		return bool(self.model and self.api_key)

	def models(self) -> list[str]:
		return list(
			dict.fromkeys(model for model in [self.model, *(self.other_models or "").split()] if model)
		)

	def model_for(self, preferred: str | None) -> str:
		return preferred if preferred in self.models() else self.model
