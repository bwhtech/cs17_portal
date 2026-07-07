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
import PublishAssignmentDialog from "@/faculty/PublishAssignmentDialog";
import DeleteAssignmentDialog from "@/faculty/DeleteAssignmentDialog";
import { Trash2, ChevronDown } from "lucide-react";

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
  const [editDraft, setEditDraft] = useState<string | null>(null);
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
  const drafts = assignments.filter(
    (assignment) => !assignment.is_published && !assignment.publish_on,
  );

  function openNew() {
    setEditDraft(null);
    setCreateOpen(true);
  }

  function openDraft(name: string) {
    setEditDraft(name);
    setCreateOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {assignments.length} total
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Assignment
        </Button>
      </div>

      {drafts.length > 0 && (
        <DraftsSection drafts={drafts} onOpen={openDraft} />
      )}

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
          <AssignmentTable
            assignments={assignments}
            onChange={mutate}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <CreateAssignmentSheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditDraft(null);
        }}
        cohorts={cohorts}
        onCreated={mutate}
        draftName={editDraft}
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

function DraftsSection({
  drafts,
  onOpen,
}: {
  drafts: FacultyAssignment[];
  onOpen: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        Drafts ({drafts.length})
        <ChevronDown
          className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {drafts.map((draft) => (
            <button
              key={draft.name}
              onClick={() => onOpen(draft.name)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
            >
              {draft.title || "Untitled"}
            </button>
          ))}
        </div>
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
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Cohort</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Submissions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
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
                    onClick={() =>
                      navigate(`/faculty/assignments/${assignment.name}`)
                    }
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!assignment.is_published && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPublishTarget(assignment)}
                      >
                        {assignment.publish_on ? "Reschedule" : "Publish"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${assignment.title}`}
                      onClick={() => onDelete(assignment)}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
