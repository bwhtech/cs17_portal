import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFrappeFileUpload, useFrappePostCall } from "frappe-react-sdk";

interface Assignment {
  name: string;
  title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  onSuccess?: () => void;
}

export default function SubmitAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, loading: uploading } = useFrappeFileUpload();
  const { call, loading: submitting } = useFrappePostCall(
    "cs17_portal.api.submit_assignment",
  );

  async function handleSubmit() {
    if (!file) return;
    setError(null);

    try {
      const uploaded = await upload(file, {
        isPrivate: true,
      });

      await call({
        assignment: assignment.name,
        file_url: uploaded.file_url,
      });

      setFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? "Submission failed. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit: {assignment.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!file || uploading || submitting}
            className="w-full"
          >
            {uploading
              ? "Uploading…"
              : submitting
                ? "Submitting…"
                : "Submit Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
