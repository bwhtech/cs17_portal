import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappeGetDocList } from "frappe-react-sdk";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
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
import PublishAssignmentDialog from "@/faculty/PublishAssignmentDialog";
import DeleteAssignmentDialog from "@/faculty/DeleteAssignmentDialog";
import { Trash2 } from "lucide-react";

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
  const [deleteTarget, setDeleteTarget] = useState<FacultyAssignment | null>(
    null,
  );

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

      <div className="md:bg-background md:border md:border-border md:rounded-xl md:p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <AssignmentTable
            assignments={assignments}
            onChange={mutate}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <CreateAssignmentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        cohorts={cohorts}
        onCreated={mutate}
      />

      {deleteTarget && (
        <DeleteAssignmentDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          assignment={deleteTarget}
          onSuccess={mutate}
        />
      )}
    </div>
  );
}

function AssignmentTable({
  assignments,
  onChange,
  onDelete,
}: {
  assignments: FacultyAssignment[];
  onChange: () => void;
  onDelete: (assignment: FacultyAssignment) => void;
}) {
  const navigate = useNavigate();
  const [publishTarget, setPublishTarget] = useState<FacultyAssignment | null>(
    null,
  );

  const columns: Column<FacultyAssignment>[] = [
    {
      header: "Title",
      variant: "primary",
      cell: (a) => (
        <button
          className="text-left hover:underline"
          onClick={() => navigate(`/faculty/assignments/${a.name}`)}
        >
          {a.title}
        </button>
      ),
    },
    {
      header: "Cohort",
      cellClassName: "text-sm text-muted-foreground",
      cell: (a) => a.cohort,
    },
    {
      header: "Type",
      cell: (a) => <Badge variant="secondary">{a.submission_type}</Badge>,
    },
    {
      header: "Due",
      cellClassName: "text-sm text-muted-foreground",
      cell: (a) => formatDateTime(a.due_date),
    },
    {
      header: "Submissions",
      cell: (a) => <Badge variant="outline">{a.submission_count}</Badge>,
    },
    {
      header: "Status",
      cell: (a) => <StatusBadge assignment={a} />,
    },
    {
      header: "",
      variant: "actions",
      cellClassName: "text-right",
      cell: (a) => (
        <div className="flex items-center justify-end gap-2">
          {!a.is_published && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPublishTarget(a)}
            >
              {a.publish_on ? "Reschedule" : "Publish"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${a.title}`}
            onClick={() => onDelete(a)}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      ),
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

      {publishTarget && (
        <PublishAssignmentDialog
          open={!!publishTarget}
          onOpenChange={(open) => !open && setPublishTarget(null)}
          assignment={publishTarget}
          onSuccess={onChange}
        />
      )}
    </>
  );
}

function StatusBadge({ assignment }: { assignment: FacultyAssignment }) {
  if (assignment.is_published) return <Badge>Published</Badge>;
  if (assignment.publish_on)
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="secondary">Scheduled</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(assignment.publish_on)}
        </span>
      </div>
    );
  return <Badge variant="outline">Draft</Badge>;
}
