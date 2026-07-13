import { Button } from "@/components/ui/button";
import RichText from "@/components/ui/RichText";
import { formatDateTime } from "@/lib/dayjs";

export interface AssignmentDraft {
  title: string;
  cohort: string;
  submission_type: string;
  assignment_type: string;
  max_marks: string;
  remarks: string;
  due_date: string;
  description: string;
}

interface Props {
  draft: AssignmentDraft;
}

// Renders a draft exactly as a student sees it on AssignmentDetailPage.
export default function AssignmentPreview({ draft }: Props) {
  const isGradeScale =
    draft.assignment_type === "Graded" && draft.remarks === "Grade";

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold mb-4">
          {draft.title || "Untitled Assignment"}
        </h1>
        <RichText content={draft.description} />
      </div>

      <div className="md:w-56 shrink-0">
        <div className="border border-border rounded-xl p-4 space-y-3">
          <Meta label="Due" value={draft.due_date ? formatDateTime(draft.due_date) : "—"} />
          {!isGradeScale && (
            <Meta
              label="Max Marks"
              value={
                draft.assignment_type === "Not Graded"
                  ? "Non Graded"
                  : draft.max_marks || "—"
              }
            />
          )}
          <Button variant="outline" className="w-full" disabled>
            Submit Assignment
          </Button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
