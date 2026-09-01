import { useEffect, useState } from "react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Eye, Pencil } from "lucide-react";
import AssignmentPreview, { type AssignmentDraft } from "@/faculty/AssignmentPreview";
import DeleteAssignmentDialog from "@/faculty/DeleteAssignmentDialog";

const SUBMISSION_TYPES = ["Any", "PDF", "URL", "Image", "ZIP", "Scratch"];
const PUBLISH_MODES = [
  { value: "draft", label: "Save as Draft" },
  { value: "now", label: "Publish Now" },
  { value: "schedule", label: "Schedule" },
];

const EMPTY_DRAFT: AssignmentDraft = {
  title: "",
  cohort: "",
  submission_type: "Any",
  assignment_type: "Not Graded",
  max_marks: "",
  remarks: "Grade",
  due_date: "",
  description: "",
};

const DRAFT_KEY = "cs17-new-assignment-draft";

interface StoredDraft {
  draft: AssignmentDraft;
  publish: string;
  publishOn: string;
}

function loadDraft(): Partial<StoredDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as StoredDraft;
  } catch {
    return {};
  }
  return {};
}

function isDraftDirty(draft: AssignmentDraft): boolean {
  return Boolean(
    draft.title.trim() || draft.description.trim() || draft.cohort || draft.due_date,
  );
}

interface AssignmentDoc {
  title?: string;
  cohort?: string;
  submission_type?: string;
  assignment_type?: string;
  max_marks?: number;
  remarks?: string;
  due_date?: string;
  description?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: string[];
  onCreated: () => void;
  draftName?: string | null;
}

// Frappe stores Datetime as "YYYY-MM-DD HH:mm:ss"; datetime-local gives "YYYY-MM-DDTHH:mm".
function toFrappeDatetime(value: string): string {
  return value ? value.replace("T", " ") + ":00" : "";
}

function toDatetimeLocal(value?: string | null): string {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

export default function CreateAssignmentSheet({
  open,
  onOpenChange,
  cohorts,
  onCreated,
  draftName,
}: Props) {
  const [initialDraft] = useState<Partial<StoredDraft>>(() =>
    draftName ? {} : loadDraft(),
  );
  const [draft, setDraft] = useState<AssignmentDraft>(initialDraft.draft ?? EMPTY_DRAFT);
  const [publish, setPublish] = useState(initialDraft.publish ?? "draft");
  const [publishOn, setPublishOn] = useState(initialDraft.publishOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { call: createCall, loading } = useFrappePostCall(
    "cs17_portal.api.create_assignment",
  );
  const { call: updateCall } = useFrappePostCall("cs17_portal.api.update_assignment");
  const { data: existingData } = useFrappeGetCall<{ message: AssignmentDoc }>(
    "cs17_portal.api.get_assignment",
    draftName ? { assignment: draftName } : undefined,
    draftName ? undefined : null,
  );
  const existing = existingData?.message;

  useEffect(() => {
    if (!open || !draftName || !existing || savedName === draftName) return;
    setDraft({
      title: existing.title ?? "",
      cohort: existing.cohort ?? "",
      submission_type: existing.submission_type ?? "Any",
      assignment_type: existing.assignment_type ?? "Not Graded",
      max_marks: existing.max_marks ? String(existing.max_marks) : "",
      remarks: existing.remarks || "Grade",
      due_date: toDatetimeLocal(existing.due_date),
      description: existing.description ?? "",
    });
    setPublish("draft");
    setSavedName(draftName);
  }, [open, draftName, existing, savedName]);

  useEffect(() => {
    if (draftName) return;
    if (isDraftDirty(draft) || publish !== "draft" || publishOn) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, publish, publishOn }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [draftName, draft, publish, publishOn]);

  const evaluationType =
    draft.assignment_type === "Graded" ? draft.remarks : "Non-graded";

  function setEvaluationType(value: string) {
    if (value === "Non-graded") {
      update({ assignment_type: "Not Graded", remarks: "", max_marks: "" });
    } else {
      update({ assignment_type: "Graded", remarks: value });
    }
  }

  function update(partial: Partial<AssignmentDraft>) {
    setError(null);
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setPublish("draft");
    setPublishOn("");
    setError(null);
    setSavedName(null);
  }

  function payload(publishMode: string) {
    return {
      title: draft.title,
      cohort: draft.cohort,
      due_date: toFrappeDatetime(draft.due_date),
      submission_type: draft.submission_type,
      description: draft.description,
      assignment_type: draft.assignment_type,
      max_marks: draft.max_marks || 0,
      remarks: draft.remarks,
      publish: publishMode,
      publish_on: toFrappeDatetime(publishOn),
    };
  }

  async function persist(publishMode: string): Promise<string> {
    if (savedName) {
      await updateCall({ assignment: savedName, ...payload(publishMode) });
      return savedName;
    }
    return createCall(payload(publishMode));
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function validate(): string | null {
    if (!draft.title.trim()) return "Title is required.";
    if (publish !== "draft") {
      if (!draft.cohort) return "Cohort is required to publish.";
      if (!draft.due_date) return "Due date is required to publish.";
    }
    if (publish === "schedule" && !publishOn) return "Pick a publish date.";
    return null;
  }

  async function handleSubmit() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    try {
      await persist(publish);
      localStorage.removeItem(DRAFT_KEY);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the assignment.");
    }
  }

  const deletableName = savedName ?? draftName ?? null;

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{draftName ? "Continue Draft" : "New Assignment"}</SheetTitle>
          <SheetDescription>
            Fill in the details, then switch to Preview to see the student view.
            Closing keeps your work as a draft.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="edit" className="flex-1 min-h-0 gap-0">
          <div className="px-5 pt-4">
            <TabsList>
              <TabsTrigger value="edit">
                <Pencil /> Edit
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye /> Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" className="overflow-y-auto p-5 space-y-4">
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Assignment title"
              />
            </Field>

            <Field label="Cohort">
              <Select
                value={draft.cohort}
                onValueChange={(value) => update({ cohort: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort} value={cohort}>
                      {cohort}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Submission Type">
                <Select
                  value={draft.submission_type}
                  onValueChange={(value) => update({ submission_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Evaluation Type">
                <Select value={evaluationType} onValueChange={setEvaluationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grade">Grade</SelectItem>
                    <SelectItem value="Marks">Marks</SelectItem>
                    <SelectItem value="Non-graded">Non-graded</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {evaluationType === "Marks" && (
              <Field label="Max Marks">
                <Input
                  type="number"
                  min={0}
                  value={draft.max_marks}
                  onChange={(e) => update({ max_marks: e.target.value })}
                />
              </Field>
            )}

            <Field label="Due Date">
              <Input
                type="datetime-local"
                value={draft.due_date}
                onChange={(e) => update({ due_date: e.target.value })}
              />
            </Field>

            <Field label="Description" hint="Markdown supported">
              <Textarea
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={"What should students do?\n\n- Use **markdown**\n- Add lists, links, headings"}
                rows={6}
              />
            </Field>

            <Field label="Publishing">
              <Select value={publish} onValueChange={setPublish}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISH_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {publish === "schedule" && (
              <Field label="Publish On">
                <Input
                  type="datetime-local"
                  value={publishOn}
                  onChange={(e) => {
                    setError(null);
                    setPublishOn(e.target.value);
                  }}
                />
              </Field>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </TabsContent>

          <TabsContent value="preview" className="overflow-y-auto p-5">
            <AssignmentPreview draft={draft} />
          </TabsContent>
        </Tabs>

        <SheetFooter className="sm:justify-between">
          {deletableName ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : draftName ? "Save Assignment" : "Create Assignment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {confirmDelete && deletableName && (
      <DeleteAssignmentDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        assignment={{ name: deletableName, title: draft.title }}
        onSuccess={() => {
          setConfirmDelete(false);
          reset();
          onOpenChange(false);
          onCreated();
        }}
      />
    )}
    </>
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
