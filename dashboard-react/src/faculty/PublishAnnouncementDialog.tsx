import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFrappePostCall } from "frappe-react-sdk";
import PublishScheduleFields from "@/faculty/PublishScheduleFields";
import { toFrappeDatetime } from "@/lib/datetime";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: { name: string; title: string } | null;
  onSuccess: () => void;
}

export default function PublishAnnouncementDialog({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: Props) {
  const [publish, setPublish] = useState("now");
  const [publishOn, setPublishOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, loading } = useFrappePostCall(
    "cs17_portal.api.publish_announcement",
  );

  useEffect(() => {
    setPublish("now");
    setPublishOn("");
    setError(null);
  }, [announcement]);

  async function handlePublish() {
    setError(null);
    if (publish === "schedule" && !publishOn) {
      setError("Pick a publish date.");
      return;
    }
    try {
      await call({
        announcement: announcement!.name,
        publish,
        publish_on: toFrappeDatetime(publishOn),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not publish the announcement.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Publish: {announcement?.title ?? "Announcement"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <PublishScheduleFields
            publish={publish}
            onPublishChange={setPublish}
            publishOn={publishOn}
            onPublishOnChange={(value) => {
              setError(null);
              setPublishOn(value);
            }}
            hint="Published announcements are visible to students in the cohort."
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handlePublish} disabled={loading} className="w-full">
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
