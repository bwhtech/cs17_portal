import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFrappePostCall } from "frappe-react-sdk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: { name: string; title: string } | null;
  onSuccess: () => void;
}

const PUBLISH_MODES = [
  { value: "now", label: "Publish Now" },
  { value: "schedule", label: "Schedule" },
];

function toFrappeDatetime(value: string): string {
  return value ? value.replace("T", " ") + ":00" : "";
}

export default function PublishAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: Props) {
  const [publish, setPublish] = useState("now");
  const [publishOn, setPublishOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.publish_assignment",
  );

  useEffect(() => {
    setPublish("now");
    setPublishOn("");
    setError(null);
  }, [assignment]);

  async function handlePublish() {
    setError(null);
    if (publish === "schedule" && !publishOn) {
      setError("Pick a publish date.");
      return;
    }
    try {
      await call({
        assignment: assignment!.name,
        publish,
        publish_on: toFrappeDatetime(publishOn),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not publish the assignment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish: {assignment?.title ?? "Assignment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
              Published assignments are visible to students in the cohort.
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

          <Button onClick={handlePublish} disabled={loading} className="w-full">
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
