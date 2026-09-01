import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFrappePostCall } from "frappe-react-sdk";

export interface GradeInfo {
  grade?: string;
  marks_obtained?: number;
  remarks?: string;
  is_published?: number;
  published_on?: string | null;
}

interface Submission {
  name: string;
  full_name?: string;
  grade?: GradeInfo | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Submission | null;
  evaluationType: string;
  maxMarks?: number;
  onSuccess: () => void;
}

const GRADES = ["A", "B", "C", "D", "E"];
const PUBLISH_MODES = [
  { value: "draft", label: "Save as Draft" },
  { value: "now", label: "Publish Now" },
  { value: "schedule", label: "Schedule" },
];

// Frappe stores Datetime as "YYYY-MM-DD HH:mm:ss"; datetime-local uses "YYYY-MM-DDTHH:mm".
function toFrappeDatetime(value: string): string {
  return value ? value.replace("T", " ") + ":00" : "";
}

function toDatetimeLocal(value?: string | null): string {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

export default function GradeSubmissionDialog({
  open,
  onOpenChange,
  submission,
  evaluationType,
  maxMarks,
  onSuccess,
}: Props) {
  const isGradeScale = evaluationType === "Grade";
  const [grade, setGrade] = useState("");
  const [marks, setMarks] = useState("");
  const [remarks, setRemarks] = useState("");
  const [publish, setPublish] = useState("draft");
  const [publishOn, setPublishOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.grade_submission",
  );

  useEffect(() => {
    const existing = submission?.grade;
    setGrade(existing?.grade ?? "");
    setMarks(existing?.marks_obtained != null ? String(existing.marks_obtained) : "");
    setRemarks(existing?.remarks ?? "");
    if (existing?.is_published) {
      setPublish("now");
      setPublishOn("");
    } else if (existing?.published_on) {
      setPublish("schedule");
      setPublishOn(toDatetimeLocal(existing.published_on));
    } else {
      setPublish("draft");
      setPublishOn("");
    }
    setError(null);
  }, [submission]);

  async function handleSave() {
    setError(null);
    if (isGradeScale && !grade) {
      setError("Please select a grade.");
      return;
    }
    if (!isGradeScale) {
      const value = Number(marks);
      if (marks.trim() === "" || Number.isNaN(value) || value < 0) {
        setError("Please enter valid marks.");
        return;
      }
      if (maxMarks != null && value > maxMarks) {
        setError(`Marks cannot exceed ${maxMarks}.`);
        return;
      }
    }
    if (publish === "schedule" && !publishOn) {
      setError("Pick a publish date.");
      return;
    }
    try {
      await call({
        submission: submission!.name,
        grade: isGradeScale ? grade : undefined,
        marks_obtained: isGradeScale ? undefined : Number(marks),
        remarks: remarks.trim() || undefined,
        publish,
        publish_on: toFrappeDatetime(publishOn),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not save the grade.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grade: {submission?.full_name ?? "Submission"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isGradeScale ? (
            <div>
              <label className="block text-sm font-medium mb-2">Grade</label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">
                Marks{maxMarks != null ? ` (out of ${maxMarks})` : ""}
              </label>
              <Input
                type="number"
                min={0}
                max={maxMarks}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Remarks</label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional feedback for the student"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Publishing</label>
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
            <p className="text-xs text-muted-foreground mt-1.5">
              Published grades are visible to the student.
            </p>
          </div>

          {publish === "schedule" && (
            <div>
              <label className="block text-sm font-medium mb-2">Publish On</label>
              <Input
                type="datetime-local"
                value={publishOn}
                onChange={(e) => {
                  setError(null);
                  setPublishOn(e.target.value);
                }}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Saving…" : "Save Grade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
