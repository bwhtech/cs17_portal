import builtins
import io
import linecache
import sys
import traceback

OUTPUT_LIMIT = 100_000
ORIGINAL_BUILTINS = dict(builtins.__dict__)


class CappedOutput(io.StringIO):
	def write(self, text):
		if self.tell() + len(text) > OUTPUT_LIMIT:
			raise RuntimeError("Output is too long.")
		return super().write(text)


def read_line(prompt=""):
	line = sys.stdin.readline()
	if not line:
		raise EOFError("EOF when reading a line")
	return line.rstrip("\n")


def run_program(code, stdin):
	stdout, stderr = CappedOutput(), CappedOutput()
	sys.stdin, sys.stdout, sys.stderr = io.StringIO(stdin), stdout, stderr
	builtins.input = read_line
	linecache.cache["main.py"] = (len(code), None, code.splitlines(keepends=True), "main.py")
	error = None
	try:
		# nosemgrep: frappe-codeinjection-eval
		exec(compile(code, "main.py", "exec"), {"__name__": "__main__"})
	except SystemExit as exc:
		if exc.code not in (None, 0):
			error = f"SystemExit: {exc.code}"
	except BaseException as exc:
		summary = traceback.TracebackException.from_exception(exc)
		summary.stack = traceback.StackSummary.from_list(
			[frame for frame in summary.stack if frame.filename == "main.py"]
		)
		error = "".join(summary.format())
	finally:
		sys.stdin, sys.stdout, sys.stderr = sys.__stdin__, sys.__stdout__, sys.__stderr__
		builtins.__dict__.clear()
		builtins.__dict__.update(ORIGINAL_BUILTINS)
	return {"stdout": stdout.getvalue(), "stderr": stderr.getvalue(), "error": error}
