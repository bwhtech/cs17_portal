import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFrappePostCall } from "frappe-react-sdk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: { name: string; title: string } | null;
  onSuccess: () => void;
}

export default function DeleteAnnouncementDialog({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.delete_announcement",
  );

  useEffect(() => {
    setError(null);
  }, [announcement]);

  async function handleDelete(event: React.MouseEvent) {
    // Keep the dialog open so a backend error stays visible.
    event.preventDefault();
    setError(null);
    try {
      await call({ announcement: announcement!.name });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not delete the announcement.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{announcement?.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the announcement. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            {loading ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
