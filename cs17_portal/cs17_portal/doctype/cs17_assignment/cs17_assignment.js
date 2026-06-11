// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Assignment", {
	refresh(frm) {
		update_graded_fields(frm);
	},

	assignment_type(frm) {
		if (!frm.doc.__islocal) return;

		frm.doc.naming_series =
			frm.doc.assignment_type === "Graded" ? "GRADED-.###" : "NOT-GRADED-.###";
		frm.refresh_field("naming_series");
		update_graded_fields(frm);
	},
});

function update_graded_fields(frm) {
	const not_graded = frm.doc.assignment_type === "Not Graded";
	frm.set_df_property("max_marks", "read_only", not_graded ? 1 : 0);
	frm.set_df_property("remarks", "read_only", not_graded ? 1 : 0);
	if (not_graded) {
		frm.set_value("max_marks", 0);
	}
}
