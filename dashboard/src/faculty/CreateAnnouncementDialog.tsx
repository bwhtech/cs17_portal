import { useState } from "react";
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
import { alertStyles } from "@/components/ui/AlertBanner";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const VARIANTS = ["info", "warning", "error"] as const;
const ALL_COHORTS = "all";

const EMPTY_DRAFT = {
  title: "",
  content: "",
  alert_variant: "info" as (typeof VARIANTS)[number],
  cohort: ALL_COHORTS,
  is_dismissible: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: string[];
  onCreated: () => void;
}

export default function CreateAnnouncementDialog({
  open,
  onOpenChange,
  cohorts,
  onCreated,
}: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.create_announcement",
  );

  function update(partial: Partial<typeof EMPTY_DRAFT>) {
    setError(null);
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit(publish: "now" | "draft") {
    if (!draft.title.trim()) return setError("Title is required.");
    if (!draft.content.trim()) return setError("Content is required.");
    try {
      await call({
        title: draft.title,
        content: draft.content,
        alert_variant: draft.alert_variant,
        cohort: draft.cohort === ALL_COHORTS ? undefined : draft.cohort,
        is_dismissible: draft.is_dismissible ? 1 : 0,
        publish,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the announcement.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
          <DialogDescription>
            Fill in the details; the preview shows how students will see it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-2">
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
          <Button
            variant="outline"
            onClick={() => submit("draft")}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button onClick={() => submit("now")} disabled={loading}>
            {loading ? "Saving…" : "Publish Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Static AlertBanner row: the dismiss X is decorative so the preview never
// touches the shared dismissed-alerts localStorage.
function AnnouncementPreview({ draft }: { draft: typeof EMPTY_DRAFT }) {
  const s = alertStyles[draft.alert_variant];
  return (
    <div className={cn("flex items-start gap-4 rounded-xl px-5 py-4", s.wrapper)}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          s.iconBg,
        )}
      >
        {s.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", s.title)}>
          {draft.title || "Announcement title"}
        </p>
        {draft.content && (
          <p className={cn("text-xs mt-0.5", s.body)}>{draft.content}</p>
        )}
      </div>
      {draft.is_dismissible && (
        <X className={cn("w-4 h-4 shrink-0 mt-0.5", s.dismiss)} />
      )}
    </div>
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
