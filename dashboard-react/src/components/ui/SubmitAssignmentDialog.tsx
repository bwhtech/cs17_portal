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
import { getSubmissionConfig, isSubmissionValid } from "@/lib/submissionTypes";

interface Assignment {
  name: string;
  title: string;
  submission_type?: string;
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
  const submissionType = assignment.submission_type ?? "Any";
  const config = getSubmissionConfig(submissionType);
  const isUrl = submissionType === "URL";
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { upload, loading: uploading } = useFrappeFileUpload();
  const { call: submitCall, loading: submitting } = useFrappePostCall(
    "cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission.submit_assignment"
  );
  const { call: editCall, loading: editing } = useFrappePostCall(
    "cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission.edit_submission"
  );

  const isEdit = !!existingSubmission;
  const loading = uploading || submitting || editing;
  const ready = isUrl ? url.trim().length > 0 : !!file;

  function clearPreview() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function reset() {
    setFile(null);
    setUrl("");
    setError(null);
    clearPreview();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleFileChange(selected: File | null) {
    setError(null);
    setFile(selected);
    clearPreview();
    if (selected && submissionType === "Image") {
      setPreview(URL.createObjectURL(selected));
    }
  }

  async function save(fileUrl: string) {
    if (isEdit) {
      await editCall({ submission: existingSubmission!.name, file_url: fileUrl });
    } else {
      await submitCall({ assignment: assignment.name, file_url: fileUrl });
    }
    reset();
    onOpenChange(false);
    onSuccess?.();
  }

  async function handleSubmit() {
    setError(null);
    if (!isSubmissionValid(submissionType, file, url)) {
      setError(config.error);
      return;
    }
    try {
      const fileUrl = isUrl
        ? url.trim()
        : (await upload(file!, { isPrivate: true })).file_url;
      await save(fileUrl);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
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
          <div>
            <label className="block text-sm font-medium mb-2">
              {config.label}
            </label>
            {isUrl ? (
              <Input
                type="url"
                placeholder="https://example.com/your-work"
                value={url}
                onChange={(e) => {
                  setError(null);
                  setUrl(e.target.value);
                }}
              />
            ) : (
              <Input
                type="file"
                accept={config.accept}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            )}
            <p className="mt-2.5 text-xs text-muted-foreground">{config.help}</p>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="max-h-40 rounded-md border border-border object-contain"
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={!ready || loading}
            className="w-full"
          >
            {buttonLabel({ uploading, submitting, editing, isEdit })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buttonLabel({
  uploading,
  submitting,
  editing,
  isEdit,
}: {
  uploading: boolean;
  submitting: boolean;
  editing: boolean;
  isEdit: boolean;
}): string {
  if (uploading) return "Uploading…";
  if (submitting || editing) return "Submitting…";
  return isEdit ? "Update Submission" : "Submit Assignment";
}
