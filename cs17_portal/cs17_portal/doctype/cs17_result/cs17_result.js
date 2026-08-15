// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Result", {
	setup(frm) {
		frm.set_query("student", () => ({ filters: { profile_type: "Student" } }));
	},

	exam(frm) {
		if (!frm.doc.exam) {
			frm.clear_table("scores");
			frm.refresh_field("scores");
			return;
		}
		frm.call("load_exam_subjects").then(() => {
			frm.refresh_field("scores");
			frm.refresh_field("quarter");
			frm.trigger("reload_assignments");
		});
	},

	quarter(frm) {
		frm.trigger("reload_assignments");
	},

	student(frm) {
		frm.trigger("reload_assignments");
	},

	reload_assignments(frm) {
		if (!frm.doc.quarter || !frm.doc.student) {
			frm.clear_table("assignments");
			frm.refresh_field("assignments");
			return;
		}
		frm.call("load_quarter_assignments").then(() => frm.refresh_field("assignments"));
	},
});
