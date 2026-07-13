import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappeGetDocList } from "frappe-react-sdk";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { formatDateTime } from "@/lib/dayjs";
import CreateAssignmentSheet from "@/faculty/CreateAssignmentSheet";

interface FacultyAssignment {
  name: string;
  title: string;
  cohort: string;
  submission_type: string;
  assignment_type: string;
  due_date: string;
  is_published: number;
  publish_on: string | null;
  submission_count: number;
}

const ALL_COHORTS = "all";

export default function FacultyAssignmentsPage() {
  const [cohortFilter, setCohortFilter] = useState(ALL_COHORTS);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: cohortDocs } = useFrappeGetDocList("CS17 Cohort", {
    fields: ["name"],
    limit: 0,
  });
  const cohorts = (cohortDocs ?? []).map((c) => c.name);

  const { data, isLoading, mutate } = useFrappeGetCall<{
    message: FacultyAssignment[];
  }>("cs17_portal.api.get_faculty_assignments", {
    cohort: cohortFilter === ALL_COHORTS ? undefined : cohortFilter,
  });

  const assignments = data?.message ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {assignments.length} total
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Assignment
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COHORTS}>All cohorts</SelectItem>
            {cohorts.map((cohort) => (
              <SelectItem key={cohort} value={cohort}>
                {cohort}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-background border border-border rounded-xl p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <AssignmentTable assignments={assignments} />
        )}
      </div>

      <CreateAssignmentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        cohorts={cohorts}
        onCreated={mutate}
      />
    </div>
  );
}

function AssignmentTable({ assignments }: { assignments: FacultyAssignment[] }) {
  const navigate = useNavigate();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Cohort</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Submissions</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground py-8"
            >
              No assignments yet.
            </TableCell>
          </TableRow>
        ) : (
          assignments.map((assignment) => (
            <TableRow key={assignment.name}>
              <TableCell className="font-medium">
                <button
                  className="text-left hover:underline"
                  onClick={() => navigate(`/faculty/assignments/${assignment.name}`)}
                >
                  {assignment.title}
                </button>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {assignment.cohort}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{assignment.submission_type}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(assignment.due_date)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{assignment.submission_count}</Badge>
              </TableCell>
              <TableCell>
                <StatusBadge assignment={assignment} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ assignment }: { assignment: FacultyAssignment }) {
  if (assignment.is_published) return <Badge>Published</Badge>;
  if (assignment.publish_on) return <Badge variant="secondary">Scheduled</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}
