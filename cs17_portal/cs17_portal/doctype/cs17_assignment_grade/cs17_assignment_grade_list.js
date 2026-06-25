frappe.listview_settings["CS17 Assignment Grade"] = {
	add_fields: ["is_published", "published_on"],

	get_indicator(doc) {
		if (doc.is_published) {
			return [__("Published"), "green", "is_published,=,1"];
		}
		if (doc.published_on) {
			return [__("Scheduled"), "blue", "is_published,=,0"];
		}
		return [__("Draft"), "gray", "is_published,=,0"];
	},
};
