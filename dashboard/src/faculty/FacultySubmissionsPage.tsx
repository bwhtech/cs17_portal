import { useNavigate } from "react-router-dom";
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
import { formatDateTime } from "@/lib/dayjs";
import { GradeBadge } from "./GradeBadge";
import type { CohortSubmission } from "./types";

export default function FacultySubmissionsPage() {
  const navigate = useNavigate();

  const { data: submissionsData, isLoading } = useFrappeGetCall<{
    message: CohortSubmission[];
  }>("cs17_portal.api.list_cohort_submissions");
  const submissions = submissionsData?.message ?? [];

  function openGrading(submission: CohortSubmission) {
    navigate(`/faculty/submissions/${submission.name}`);
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
                <TableRow
                  key={submission.name}
                  onClick={() => openGrading(submission)}
                  className="cursor-pointer transition-colors hover:bg-muted"
                >
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
                    <GradeBadge submission={submission} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="cursor-pointer transition-colors hover:bg-primary/90"
                      onClick={(event) => {
                        event.stopPropagation();
                        openGrading(submission);
                      }}
                    >
                      {submission.graded ? "Review" : "Grade"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
