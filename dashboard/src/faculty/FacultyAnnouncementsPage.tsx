import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import CreateAnnouncementDialog from "@/faculty/CreateAnnouncementDialog";
import DeleteAnnouncementDialog from "@/faculty/DeleteAnnouncementDialog";
import PreviewAnnouncementDialog from "@/faculty/PreviewAnnouncementDialog";
import PublishAnnouncementDialog from "@/faculty/PublishAnnouncementDialog";

interface FacultyAnnouncement {
  name: string;
  title: string;
  content: string;
  alert_variant: string;
  cohort: string | null;
  is_dismissible: number;
  is_published: number;
  published_date: string | null;
  publish_on: string | null;
}

const variantColor: Record<string, string> = {
  error: "bg-red-500",
  warning: "bg-yellow-400",
  info: "bg-blue-500",
};

export default function FacultyAnnouncementsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FacultyAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FacultyAnnouncement | null>(
    null,
  );
  const [previewTarget, setPreviewTarget] =
    useState<FacultyAnnouncement | null>(null);

  function openNew() {
    setEditTarget(null);
    setCreateOpen(true);
  }

  function openEdit(announcement: FacultyAnnouncement) {
    setEditTarget(announcement);
    setCreateOpen(true);
  }

  const { data: cohortDocs } = useFrappeGetDocList("CS17 Cohort", {
    fields: ["name"],
    limit: 0,
  });
  const cohorts = (cohortDocs ?? []).map((c) => c.name);

  const { data, isLoading, mutate } = useFrappeGetCall<{
    message: FacultyAnnouncement[];
  }>("cs17_portal.api.get_faculty_announcements", {});
  const announcements = data?.message ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {announcements.length} total
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Announcement
        </Button>
      </div>

      <div className="bg-background border border-border rounded-xl p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <AnnouncementTable
            announcements={announcements}
            onChange={mutate}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onPreview={setPreviewTarget}
          />
        )}
      </div>

      <CreateAnnouncementDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditTarget(null);
        }}
        cohorts={cohorts}
        onCreated={mutate}
        editTarget={editTarget}
      />

      {deleteTarget && (
        <DeleteAnnouncementDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          announcement={deleteTarget}
          onSuccess={mutate}
        />
      )}

      <PreviewAnnouncementDialog
        open={!!previewTarget}
        onOpenChange={(open) => !open && setPreviewTarget(null)}
        announcement={previewTarget}
      />
    </div>
  );
}

function AnnouncementTable({
  announcements,
  onChange,
  onEdit,
  onDelete,
  onPreview,
}: {
  announcements: FacultyAnnouncement[];
  onChange: () => void;
  onEdit: (announcement: FacultyAnnouncement) => void;
  onDelete: (announcement: FacultyAnnouncement) => void;
  onPreview: (announcement: FacultyAnnouncement) => void;
}) {
  const [publishTarget, setPublishTarget] =
    useState<FacultyAnnouncement | null>(null);

  if (announcements.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No announcements yet.
      </p>
    );
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Cohort</TableHead>
          <TableHead>Variant</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {announcements.map((announcement) => (
          <TableRow key={announcement.name}>
            <TableCell className="font-medium">{announcement.title}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {announcement.cohort ?? "All cohorts"}
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2 text-sm capitalize">
                <span
                  className={`w-2 h-2 rounded-full ${
                    variantColor[announcement.alert_variant] ?? variantColor.info
                  }`}
                />
                {announcement.alert_variant}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge announcement={announcement} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Preview ${announcement.title}`}
                  onClick={() => onPreview(announcement)}
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </Button>
                {!announcement.is_published && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${announcement.title}`}
                      onClick={() => onEdit(announcement)}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPublishTarget(announcement)}
                    >
                      Publish
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${announcement.title}`}
                  onClick={() => onDelete(announcement)}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {publishTarget && (
      <PublishAnnouncementDialog
        open={!!publishTarget}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        announcement={publishTarget}
        onSuccess={onChange}
      />
    )}
    </>
  );
}

function StatusBadge({ announcement }: { announcement: FacultyAnnouncement }) {
  if (announcement.is_published)
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge>Published</Badge>
        {announcement.published_date && (
          <span className="text-xs text-muted-foreground">
            {formatDate(announcement.published_date)}
          </span>
        )}
      </div>
    );
  if (announcement.publish_on)
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="secondary">Scheduled</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(announcement.publish_on)}
        </span>
      </div>
    );
  return <Badge variant="outline">Draft</Badge>;
}
