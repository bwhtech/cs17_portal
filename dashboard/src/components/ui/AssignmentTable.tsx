import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-8"
              >
                No assignments yet.
              </TableCell>
            </TableRow>
          )}
          {assignments.map((a) => {
            const submission = submissionMap[a.name];
            const isGraded = !!gradeMap?.[a.name];
            const status = getStatus(a, submission, isGraded);

            return (
              <TableRow key={a.name}>
                <TableCell className="font-medium">
                  <button
                    className="text-left hover:underline"
                    onClick={() =>
                      navigate(`/assignments/${a.name}/submission`)
                    }
                  >
                    {a.title}
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(a.due_date)}
                </TableCell>
                <TableCell>
                  {status === "submitted" && (
                    <Badge variant="default">Submitted</Badge>
                  )}
                  {status === "closed" && (
                    <Badge variant="outline">Closed</Badge>
                  )}
                  {status === "pending" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {submission ? formatDateTime(submission.submitted_at) : null}
                </TableCell>
                <TableCell className="text-right">
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewGrade(a.name)}
                      >
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
          title={previewAssignment.title}
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
