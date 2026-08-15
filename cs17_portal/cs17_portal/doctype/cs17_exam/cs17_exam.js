// Copyright (c) 2026, developers@bwh.tech and contributors
// For license information, please see license.txt

frappe.ui.form.on("CS17 Exam", {
	setup(frm) {
		frm.set_query("subject", "subjects", () => ({ filters: { is_active: 1 } }));
		frm.set_query("examiner", "subjects", () => ({ filters: { profile_type: "Faculty" } }));
	},
});
