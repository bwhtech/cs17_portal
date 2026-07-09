import { useState } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
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
import { Skeleton } from "@/components/ui/skeleton";
import ScratchGradingDialog, {
  type GradingSubmission,
} from "@/components/ui/ScratchGradingDialog";
import { formatDateTime } from "@/lib/dayjs";

interface CohortSubmission {
  name: string;
  student: string;
  full_name: string;
  assignment: string;
  assignment_title: string;
  submission_type: string | null;
  max_marks: number;
  submitted_at: string;
  marks_obtained: number | null;
  grade: string | null;
  graded: boolean;
}

export default function FacultySubmissionsPage() {
  const [grading, setGrading] = useState<GradingSubmission | null>(null);

  const {
    data: submissionsData,
    isLoading,
    mutate: refreshSubmissions,
  } = useFrappeGetCall<{ message: CohortSubmission[] }>(
    "cs17_portal.api.list_cohort_submissions",
  );
  const submissions = submissionsData?.message ?? [];

  function openGrading(submission: CohortSubmission) {
    setGrading({
      name: submission.name,
      assignment: submission.assignment,
      assignment_title: submission.assignment_title,
      full_name: submission.full_name,
      submission_type: submission.submission_type ?? undefined,
      max_marks: submission.max_marks ?? 0,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open, run, and grade submissions from your cohort.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Assignment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No submissions yet.
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((submission) => (
                <TableRow key={submission.name}>
                  <TableCell className="font-medium">{submission.full_name}</TableCell>
                  <TableCell>{submission.assignment_title}</TableCell>
                  <TableCell>
                    {submission.submission_type ? (
                      <Badge variant="outline">{submission.submission_type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {submission.submitted_at
                      ? formatDateTime(submission.submitted_at)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {submission.graded ? (
                      <Badge variant="default">
                        {submission.marks_obtained != null
                          ? `${submission.marks_obtained} / ${submission.max_marks}`
                          : (submission.grade ?? "Graded")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => openGrading(submission)}>
                      {submission.graded ? "Review" : "Grade"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {grading && (
        <ScratchGradingDialog
          open={!!grading}
          onOpenChange={(open) => {
            if (!open) setGrading(null);
          }}
          submission={grading}
          onGraded={() => {
            refreshSubmissions();
          }}
        />
      )}
    </div>
  );
}
