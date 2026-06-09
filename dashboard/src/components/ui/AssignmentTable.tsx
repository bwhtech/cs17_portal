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
import { formatDateTime } from "@/lib/dayjs";
import { useNavigate } from "react-router-dom";

interface Assignment {
  name: string;
  title: string;
  due_date: string;
  max_marks: number;
  assignment_type?: string;
}

interface Submission {
  name: string;
  assignment: string;
  submitted_at: string;
  modified: string | null;
}

interface Props {
  assignments: Assignment[];
  submissionMap: Record<string, Submission>;
  gradeMap?: Record<string, any>;
  onSubmitSuccess: () => void;
  onViewGrade?: (assignmentName: string) => void;
}

function getStatus(assignment: Assignment, submission: Submission | undefined) {
  if (submission) return "submitted";
  if (new Date(assignment.due_date) < new Date()) return "overdue";
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
            <TableHead className="text-right">Action</TableHead>
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
            const status = getStatus(a, submission);
            const isGraded = !!gradeMap?.[a.name];

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
                  {status === "overdue" && (
                    <Badge variant="destructive">Overdue</Badge>
                  )}
                  {status === "pending" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {submission ? (
                    <span>
                      {submission.modified &&
                      new Date(submission.modified).getTime() >
                        new Date(submission.submitted_at).getTime() + 5000
                        ? formatDateTime(submission.modified)
                        : formatDateTime(submission.submitted_at)}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {status === "submitted" ? (
                    <div className="flex items-center justify-end gap-2">
                      {!isGraded && (
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
                      )}
                      {onViewGrade && a.assignment_type !== "Not Graded" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewGrade(a.name)}
                        >
                          View Grade
                        </Button>
                      )}
                    </div>
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
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
    </>
  );
}
