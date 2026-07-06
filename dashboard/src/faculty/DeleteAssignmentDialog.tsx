import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFrappePostCall } from "frappe-react-sdk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: { name: string; title: string } | null;
  onSuccess: () => void;
}

export default function DeleteAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.delete_assignment",
  );

  useEffect(() => {
    setError(null);
  }, [assignment]);

  async function handleDelete() {
    setError(null);
    try {
      await call({ assignment: assignment!.name });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not delete the assignment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{assignment?.title}"?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This permanently removes the assignment. This cannot be undone.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
