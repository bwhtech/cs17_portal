import { useState } from "react";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SubmitAssignmentDialog from "@/components/ui/SubmitAssignmentDialog";
import SubmissionPreviewDialog from "@/components/ui/SubmissionPreviewDialog";
import { formatDateTime } from "@/lib/dayjs";
import { useNavigate } from "react-router-dom";

interface Assignment {
  name: string;
  title: string;
  due_date: string;
  max_marks: number;
  assignment_type?: string;
  submission_type?: string;
}

interface Submission {
  name: string;
  assignment: string;
  submitted_at: string;
  submission_document?: string;
  submission_url?: string;
}

interface Props {
  assignments: Assignment[];
  submissionMap: Record<string, Submission>;
  gradeMap?: Record<string, any>;
  onSubmitSuccess: () => void;
  onViewGrade?: (assignmentName: string) => void;
}

function getStatus(
  assignment: Assignment,
  submission: Submission | undefined,
  isGraded: boolean,
) {
  if (isGraded) return "closed";
  if (submission) return "submitted";
  if (new Date(assignment.due_date) < new Date()) return "closed";
  return "pending";
}

export default function AssignmentTable({
  assignments,
  submissionMap,
  gradeMap,
  onSubmitSuccess,
  onViewGrade,
}: Props) {
  const [dialogAssignment, setDialogAssignment] = useState<Assignment | null>(
    null,
  );
  const [editSubmission, setEditSubmission] = useState<Submission | null>(null);
  const [previewAssignment, setPreviewAssignment] = useState<Assignment | null>(
    null,
  );
  const [previewSubmission, setPreviewSubmission] = useState<Submission | null>(
    null,
  );
  const navigate = useNavigate();

  const columns: Column<Assignment>[] = [
    {
      header: "Title",
      variant: "primary",
      cellClassName: "font-medium",
      cell: (a) => (
        <button
          className="text-left hover:underline"
          onClick={() => navigate(`/assignments/${a.name}/submission`)}
        >
          {a.title}
        </button>
      ),
    },
    {
      header: "Due",
      cellClassName: "text-sm text-muted-foreground",
      cell: (a) => formatDateTime(a.due_date),
    },
    {
      header: "Status",
      cell: (a) => {
        const status = getStatus(a, submissionMap[a.name], !!gradeMap?.[a.name]);
        if (status === "submitted") return <Badge variant="default">Submitted</Badge>;
        if (status === "closed") return <Badge variant="outline">Closed</Badge>;
        return <Badge variant="secondary">Pending</Badge>;
      },
    },
    {
      header: "Submitted",
      cellClassName: "text-sm text-muted-foreground",
      cell: (a) => {
        const submission = submissionMap[a.name];
        return submission ? formatDateTime(submission.submitted_at) : null;
      },
    },
    {
      header: "",
      variant: "actions",
      cellClassName: "text-right",
      cell: (a) => {
        const submission = submissionMap[a.name];
        const isGraded = !!gradeMap?.[a.name];
        const status = getStatus(a, submission, isGraded);
        return (
          <div className="flex items-center justify-end gap-2">
            {submission && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPreviewAssignment(a);
                  setPreviewSubmission(submission);
                }}
              >
                Preview
              </Button>
            )}
            {status === "closed" && isGraded && onViewGrade && a.assignment_type !== "Not Graded" ? (
              <Button size="sm" variant="ghost" onClick={() => onViewGrade(a.name)}>
                View Grade
              </Button>
            ) : status === "submitted" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDialogAssignment(a);
                  setEditSubmission(submission);
                }}
              >
                Edit
              </Button>
            ) : status === "pending" ? (
              <Button
                size="sm"
                onClick={() => {
                  setDialogAssignment(a);
                  setEditSubmission(null);
                }}
              >
                Submit
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <ResponsiveTable
        columns={columns}
        rows={assignments}
        rowKey={(a) => a.name}
        empty="No assignments yet."
      />

      {dialogAssignment && (
        <SubmitAssignmentDialog
          open={!!dialogAssignment}
          onOpenChange={(open) => {
            if (!open) {
              setDialogAssignment(null);
              setEditSubmission(null);
            }
          }}
          assignment={dialogAssignment}
          existingSubmission={editSubmission}
          onSuccess={() => {
            setDialogAssignment(null);
            setEditSubmission(null);
            onSubmitSuccess();
          }}
        />
      )}

      {previewAssignment && (
        <SubmissionPreviewDialog
          open={!!previewAssignment}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewAssignment(null);
              setPreviewSubmission(null);
            }
          }}
          title={`Your Submission: ${previewAssignment.title}`}
          submissionType={previewAssignment.submission_type}
          fileUrl={
            previewSubmission?.submission_document ||
            previewSubmission?.submission_url
          }
        />
      )}
    </>
  );
}
