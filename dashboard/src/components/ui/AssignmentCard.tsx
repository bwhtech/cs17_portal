import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  assignment: Assignment;
  submission: Submission | null;
  onSubmitSuccess?: () => void;
}

export default function AssignmentCard({ assignment, submission, onSubmitSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const isOverdue = new Date(assignment.due_date) < new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-base">{assignment.title}</CardTitle>
        <div className="shrink-0">
          {submission ? (
            <Badge variant="default">Submitted</Badge>
          ) : isOverdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Due: {assignment.due_date} · Max marks: {assignment.max_marks}
        </div>
        {submission ? (
          <p className="text-xs text-muted-foreground">
            Submitted on {new Date(submission.submitted_at).toLocaleDateString()}
          </p>
        ) : (
          <Button size="sm" onClick={() => setOpen(true)}>
            Submit
          </Button>
        )}
      </CardContent>

      <SubmitAssignmentDialog
        open={open}
        onOpenChange={setOpen}
        assignment={assignment}
        onSuccess={onSubmitSuccess}
      />
    </Card>
  );
}