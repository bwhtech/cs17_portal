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

interface Submission {
  name: string;
  assignment: string;
  submitted_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  existingSubmission?: Submission | null;
  onSuccess?: () => void;
}

export default function SubmitAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  existingSubmission,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, loading: uploading } = useFrappeFileUpload();
  const [submitting, setSubmitting] = useState(false);

  const { call: editCall, loading: editing } = useFrappePostCall(
    "cs17_portal.api.edit_submission"
  );

  const isEdit = !!existingSubmission;
  const loading = uploading || submitting || editing;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFile(null);
      setError(null);
    }
    onOpenChange(open);
  }

  async function handleSubmit() {
    if (!file) return;
    setError(null);

    try {
      const uploaded = await upload(file, { isPrivate: true });

      if (isEdit) {
        await editCall({
          submission: existingSubmission!.name,
          file_url: uploaded.file_url,
        });
      } else {
        setSubmitting(true);
        const res = await fetch(
          "/api/method/cs17_portal.api.submit_assignment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Frappe-CSRF-Token": (window as any).csrf_token,
            },
            body: JSON.stringify({
              assignment: assignment.name,
              file_url: uploaded.file_url,
            }),
          }
        );
        setSubmitting(false);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.message ?? data?.exc_type ?? "Submission failed.");
        }
      }

      setFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setSubmitting(false);
      setError(err?.message ?? "Submission failed. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Submission: " : "Submit: "}
            {assignment.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!file || loading}
            className="w-full"
          >
            {uploading
              ? "Uploading…"
              : submitting || editing
              ? "Submitting…"
              : isEdit
              ? "Update Submission"
              : "Submit Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}