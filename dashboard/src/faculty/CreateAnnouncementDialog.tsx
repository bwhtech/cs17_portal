import { useEffect, useRef, useState } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import AnnouncementPreview from "@/faculty/AnnouncementPreview";
import PublishScheduleFields from "@/faculty/PublishScheduleFields";
import { toFrappeDatetime, toDatetimeLocal } from "@/lib/datetime";

const VARIANTS = ["info", "warning", "error"] as const;
const ALL_COHORTS = "all";

const EMPTY_DRAFT = {
  title: "",
  content: "",
  alert_variant: "info" as (typeof VARIANTS)[number],
  cohort: ALL_COHORTS,
  is_dismissible: true,
};

export interface AnnouncementRow {
  name: string;
  title: string;
  content: string;
  alert_variant: string;
  cohort: string | null;
  is_dismissible: number;
  publish_on: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: string[];
  onCreated: () => void;
  editTarget?: AnnouncementRow | null;
}

export default function CreateAnnouncementDialog({
  open,
  onOpenChange,
  cohorts,
  onCreated,
  editTarget,
}: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [publish, setPublish] = useState("draft");
  const [publishOn, setPublishOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call: createCall, loading } = useFrappePostCall(
    "cs17_portal.api.create_announcement",
  );
  const { call: updateCall } = useFrappePostCall(
    "cs17_portal.api.update_announcement",
  );
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      loadedRef.current = null;
      return;
    }
    if (editTarget && loadedRef.current !== editTarget.name) {
      setDraft({
        title: editTarget.title ?? "",
        content: editTarget.content ?? "",
        alert_variant: (editTarget.alert_variant ??
          "info") as (typeof VARIANTS)[number],
        cohort: editTarget.cohort ?? ALL_COHORTS,
        is_dismissible: Boolean(editTarget.is_dismissible),
      });
      setPublish(editTarget.publish_on ? "schedule" : "draft");
      setPublishOn(toDatetimeLocal(editTarget.publish_on));
      loadedRef.current = editTarget.name;
    }
  }, [open, editTarget]);

  function update(partial: Partial<typeof EMPTY_DRAFT>) {
    setError(null);
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setPublish("draft");
    setPublishOn("");
    setError(null);
  }

  async function submit() {
    if (!draft.title.trim()) return setError("Title is required.");
    if (publish === "schedule" && !publishOn)
      return setError("Pick a publish date.");
    const payload = {
      title: draft.title,
      content: draft.content,
      alert_variant: draft.alert_variant,
      cohort: draft.cohort === ALL_COHORTS ? undefined : draft.cohort,
      is_dismissible: draft.is_dismissible ? 1 : 0,
      publish,
      publish_on: toFrappeDatetime(publishOn),
    };
    try {
      if (editTarget) {
        await updateCall({ announcement: editTarget.name, ...payload });
      } else {
        await createCall(payload);
      }
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the announcement.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {editTarget ? "Edit Announcement" : "New Announcement"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details; the preview shows how students will see it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Announcement title"
              />
            </Field>

            <Field label="Content" hint="Markdown supported">
              <Textarea
                value={draft.content}
                onChange={(e) => update({ content: e.target.value })}
                placeholder="What do you want students to know?"
                rows={5}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Variant">
                <Select
                  value={draft.alert_variant}
                  onValueChange={(value) =>
                    update({ alert_variant: value as typeof draft.alert_variant })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANTS.map((variant) => (
                      <SelectItem key={variant} value={variant}>
                        {variant}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Cohort">
                <Select
                  value={draft.cohort}
                  onValueChange={(value) => update({ cohort: value })}
                >
                  <SelectTrigger>
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
              </Field>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Dismissible</label>
              <Switch
                checked={draft.is_dismissible}
                onCheckedChange={(value) => update({ is_dismissible: value })}
              />
            </div>

            <PublishScheduleFields
              includeDraft
              publish={publish}
              onPublishChange={setPublish}
              publishOn={publishOn}
              onPublishOnChange={(value) => {
                setError(null);
                setPublishOn(value);
              }}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <Field label="Preview">
            <div className="rounded-xl border border-border p-3 min-h-24">
              {draft.title.trim() || draft.content.trim() ? (
                <AnnouncementPreview draft={draft} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Start typing to see a preview.
                </p>
              )}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={submit} disabled={loading}>
            {loading ? "Saving…" : editTarget ? "Save Changes" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
