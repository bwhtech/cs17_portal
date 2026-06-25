// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Assignment Grade", {
	refresh(frm) {
		frm.set_query("assignment", () => ({
			filters: { assignment_type: "Graded" },
		}));

		frm.set_query("submission", () => ({
			filters: { assignment: frm.doc.assignment },
		}));
	},

	assignment(frm) {
		frm.set_value("submission", null);
	},
});
