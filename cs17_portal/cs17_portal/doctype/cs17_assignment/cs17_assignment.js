// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Assignment", {
	refresh(frm) {
		update_graded_fields(frm);

		if (!frm.doc.__islocal) {
			frm.add_custom_button(__('Copy Submission Link'), () => {
				const link = `${window.location.origin}/submit/${frm.doc.name}`;
				frappe.utils.copy_to_clipboard(link);
			});
		}
	},

	assignment_type(frm) {
		if (!frm.doc.__islocal) return;

		frm.set_value(
			"naming_series",
			frm.doc.assignment_type === "Graded" ? "GRADED-.###" : "NOT-GRADED-.###"
		);
		update_graded_fields(frm);
	},
});

function update_graded_fields(frm) {
	const not_graded = frm.doc.assignment_type === "Not Graded";
	frm.toggle_enable("max_marks", !not_graded);
	frm.toggle_enable("remarks", !not_graded);
	if (not_graded) {
		frm.set_value("max_marks", 0);
	}
}