import { useState } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
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

const SUBMISSION_TYPES = ["Any", "PDF", "URL", "Image", "ZIP"];
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: string[];
  onCreated: () => void;
}

// Frappe stores Datetime as "YYYY-MM-DD HH:mm:ss"; datetime-local gives "YYYY-MM-DDTHH:mm".
function toFrappeDatetime(value: string): string {
  return value ? value.replace("T", " ") + ":00" : "";
}

export default function CreateAssignmentSheet({
  open,
  onOpenChange,
  cohorts,
  onCreated,
}: Props) {
  const [draft, setDraft] = useState<AssignmentDraft>(EMPTY_DRAFT);
  const [publish, setPublish] = useState("draft");
  const [publishOn, setPublishOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall("cs17_portal.api.create_assignment");

  // Single "Evaluation Type" control fronts the stored assignment_type + remarks.
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
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function validate(): string | null {
    if (!draft.title.trim()) return "Title is required.";
    if (!draft.cohort) return "Cohort is required.";
    if (!draft.due_date) return "Due date is required.";
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
      await call({
        title: draft.title,
        cohort: draft.cohort,
        due_date: toFrappeDatetime(draft.due_date),
        submission_type: draft.submission_type,
        description: draft.description,
        assignment_type: draft.assignment_type,
        max_marks: draft.max_marks || 0,
        remarks: draft.remarks,
        publish,
        publish_on: toFrappeDatetime(publishOn),
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Could not create the assignment.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>New Assignment</SheetTitle>
          <SheetDescription>
            Fill in the details, then switch to Preview to see the student view.
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

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : "Create Assignment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
