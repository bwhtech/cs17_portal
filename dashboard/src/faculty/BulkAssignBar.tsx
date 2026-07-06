import { useState } from "react";
import { Button } from "@/components/ui/button";
import FacultySelect from "@/faculty/FacultySelect";
import { useFrappePostCall } from "frappe-react-sdk";

interface Props {
  submissions: string[];
  onDone: () => void;
}

export default function BulkAssignBar({ submissions, onDone }: Props) {
  const [assignTo, setAssignTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.assign_submissions",
  );

  async function handleAssign() {
    setError(null);
    if (!assignTo) {
      setError("Pick a faculty member.");
      return;
    }
    try {
      await call({ submissions, assign_to: assignTo });
      setAssignTo("");
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not assign the submissions.");
    }
  }

  return (
    <div className="flex items-center gap-3 mb-3 rounded-lg border border-border bg-muted/40 px-4 py-2">
      <span className="text-sm font-medium">
        {submissions.length} selected
      </span>
      <div className="w-56">
        <FacultySelect
          value={assignTo}
          onChange={setAssignTo}
          placeholder="Assign selected to…"
        />
      </div>
      <Button size="sm" onClick={handleAssign} disabled={loading}>
        {loading ? "Assigning…" : "Assign"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
