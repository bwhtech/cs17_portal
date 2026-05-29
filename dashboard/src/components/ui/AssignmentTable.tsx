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

interface Assignment {
  name: string;
  title: string;
  due_date: string;
  max_marks: number;
}

interface Submission {
  name: string;
  assignment: string;
  submitted_at: string;
}

interface Props {
  assignments: Assignment[];
  submissionMap: Record<string, Submission>;
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
  onSubmitSuccess,
  onViewGrade,
}: Props) {
  const [dialogAssignment, setDialogAssignment] = useState<Assignment | null>(
    null,
  );
  const [editSubmission, setEditSubmission] = useState<Submission | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground py-8"
              >
                No assignments yet.
              </TableCell>
            </TableRow>
          )}
          {assignments.map((a) => {
            const submission = submissionMap[a.name];
            const status = getStatus(a, submission);
            const due = new Date(a.due_date);

            return (
              <TableRow key={a.name}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {due.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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
                <TableCell className="text-right">
                  {status === "submitted" ? (
                    <div className="flex items-center justify-end gap-2">
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
                      {onViewGrade && (
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
