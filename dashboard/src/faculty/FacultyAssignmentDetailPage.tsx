import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFrappeGetCall } from "frappe-react-sdk";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RichText from "@/components/ui/RichText";
import SubmissionPreviewDialog from "@/components/ui/SubmissionPreviewDialog";
import GradeSubmissionDialog from "@/faculty/GradeSubmissionDialog";
import type { GradeInfo } from "@/faculty/GradeSubmissionDialog";
import { formatDateTime } from "@/lib/dayjs";
import { useBreadcrumb } from "@/context/BreadcrumbContext";

interface Assignment {
  name: string;
  title: string;
  description?: string;
  due_date: string;
  cohort: string;
  submission_type?: string;
  assignment_type?: string;
  max_marks?: number;
  remarks?: string;
}

interface Submission {
  name: string;
  student: string;
  full_name?: string;
  submitted_at: string;
  submission_document?: string;
  submission_url?: string;
  grade?: GradeInfo | null;
}

export default function FacultyAssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { setBreadcrumb } = useBreadcrumb();
  const [gradeTarget, setGradeTarget] = useState<Submission | null>(null);
  const [preview, setPreview] = useState<Submission | null>(null);

  const { data, isLoading, mutate } = useFrappeGetCall<{
    message: { assignment: Assignment; submissions: Submission[] };
  }>("cs17_portal.api.get_assignment_submissions", { assignment: assignmentId });

  const assignment = data?.message.assignment;
  const submissions = data?.message.submissions ?? [];

  useEffect(() => {
    if (!assignment) return;
    setBreadcrumb([
      { label: "Assignments", href: "/faculty/assignments" },
      { label: assignment.title },
    ]);
    return () => setBreadcrumb([]);
  }, [assignment?.title]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!assignment) {
    return <p className="text-muted-foreground">Assignment not found.</p>;
  }

  const isGraded = assignment.assignment_type === "Graded";
  const isGradeScale = isGraded && assignment.remarks === "Grade";

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/faculty/assignments")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Assignments
      </button>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-4">{assignment.title}</h1>
          <RichText content={assignment.description} />
        </div>

        <div className="w-64 shrink-0">
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p className="text-sm font-medium">
                {formatDateTime(assignment.due_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cohort</p>
              <p className="text-sm font-medium">{assignment.cohort}</p>
            </div>
            {isGraded && !isGradeScale && (
              <div>
                <p className="text-xs text-muted-foreground">Max Marks</p>
                <p className="text-sm font-medium">{assignment.max_marks}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Submissions ({submissions.length})
        </h2>
        <div className="bg-background border border-border rounded-xl p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    No submissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((submission) => (
                  <TableRow key={submission.name}>
                    <TableCell className="font-medium">
                      {submission.full_name ?? submission.student}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(submission.submitted_at)}
                    </TableCell>
                    <TableCell>
                      <GradeCell
                        grade={submission.grade}
                        isGradeScale={isGradeScale}
                        isGraded={isGraded}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreview(submission)}
                        >
                          Preview
                        </Button>
                        {isGraded && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setGradeTarget(submission)}
                          >
                            {submission.grade ? "Edit Grade" : "Grade"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {preview && (
        <SubmissionPreviewDialog
          open={!!preview}
          onOpenChange={(open) => !open && setPreview(null)}
          title={preview.full_name ?? preview.student}
          submissionType={assignment.submission_type}
          fileUrl={preview.submission_document || preview.submission_url}
        />
      )}

      {gradeTarget && (
        <GradeSubmissionDialog
          open={!!gradeTarget}
          onOpenChange={(open) => !open && setGradeTarget(null)}
          submission={gradeTarget}
          evaluationType={assignment.remarks ?? "Marks"}
          maxMarks={assignment.max_marks}
          onSuccess={mutate}
        />
      )}
    </div>
  );
}

function GradeCell({
  grade,
  isGradeScale,
  isGraded,
}: {
  grade?: GradeInfo | null;
  isGradeScale: boolean;
  isGraded: boolean;
}) {
  if (!isGraded) return <span className="text-sm text-muted-foreground">—</span>;
  if (!grade) return <Badge variant="secondary">Ungraded</Badge>;
  const value = isGradeScale ? grade.grade : grade.marks_obtained;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{value ?? "—"}</span>
      {grade.is_published ? (
        <Badge>Published</Badge>
      ) : (
        <Badge variant="outline">Draft</Badge>
      )}
    </div>
  );
}
