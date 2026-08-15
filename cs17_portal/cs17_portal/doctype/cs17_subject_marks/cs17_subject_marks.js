// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Subject Marks", {
	setup(frm) {
		frm.set_query("student", () => ({ filters: { profile_type: "Student" } }));
	},

	subject(frm) {
		if (!frm.doc.exam || !frm.doc.subject) {
			return;
		}
		frm.call("load_pattern_components").then(() => frm.refresh_field("components"));
	},
});
