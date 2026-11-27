from cs17_portal.cs17_portal.doctype.cs17_code_run import cs17_code_run
from cs17_portal.cs17_portal.doctype.cs17_code_snapshot import cs17_code_snapshot


def execute():
	cs17_code_snapshot.on_doctype_update()
	cs17_code_run.on_doctype_update()
