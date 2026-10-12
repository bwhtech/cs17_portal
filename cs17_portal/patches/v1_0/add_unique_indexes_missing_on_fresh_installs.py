from cs17_portal.cs17_portal.doctype.cs17_result import cs17_result
from cs17_portal.cs17_portal.doctype.cs17_subject_marks import cs17_subject_marks


def execute():
	cs17_result.on_doctype_update()
	cs17_subject_marks.on_doctype_update()
