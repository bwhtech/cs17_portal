import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FacultySelect from "@/faculty/FacultySelect";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";

interface FacultyMember {
  user: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: { name: string; full_name?: string; assignedTo: string[] } | null;
  onSuccess: () => void;
}

export default function AssignSubmissionDialog({
  open,
  onOpenChange,
  submission,
  onSuccess,
}: Props) {
  const [assignTo, setAssignTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: faculty } = useFrappeGetCall<{ message: FacultyMember[] }>(
    "cs17_portal.api.get_faculty_members",
  );
  const { call: assign, loading } = useFrappePostCall(
    "cs17_portal.api.assign_submission",
  );
  const { call: unassign } = useFrappePostCall(
    "cs17_portal.api.unassign_submission",
  );

  useEffect(() => {
    setAssignTo("");
    setError(null);
  }, [submission?.name]);

  const members = faculty?.message ?? [];
  const assignees = submission?.assignedTo ?? [];
  const nameFor = (user: string) =>
    members.find((member) => member.user === user)?.full_name ?? user;

  async function handleAssign() {
    setError(null);
    if (!assignTo) {
      setError("Select a faculty member.");
      return;
    }
    try {
      await assign({ submission: submission!.name, assign_to: assignTo });
      setAssignTo("");
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Could not assign the submission.");
    }
  }

  async function handleUnassign(user: string) {
    setError(null);
    try {
      await unassign({ submission: submission!.name, assign_to: user });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Could not remove the assignment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign: {submission?.full_name ?? "Submission"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-2">
              Currently assigned
            </label>
            {assignees.length === 0 ? (
              <p className="text-xs text-muted-foreground">No one yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignees.map((user) => (
                  <button
                    key={user}
                    onClick={() => handleUnassign(user)}
                    className="text-xs bg-muted rounded-full px-3 py-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Click to remove"
                  >
                    {nameFor(user)} ✕
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Assign to faculty
            </label>
            <FacultySelect value={assignTo} onChange={setAssignTo} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleAssign} disabled={loading} className="w-full">
            {loading ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
