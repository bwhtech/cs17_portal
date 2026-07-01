import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { previewKind } from "@/lib/submissionTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submissionType?: string;
  fileUrl?: string | null;
}

export default function SubmissionPreviewDialog({
  open,
  onOpenChange,
  title,
  submissionType,
  fileUrl,
}: Props) {
  const kind = previewKind(submissionType, fileUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {!fileUrl ? (
            <p className="text-sm text-muted-foreground">
              No submission found.
            </p>
          ) : kind === "image" ? (
            <img
              src={fileUrl}
              alt="Submission preview"
              className="max-h-[60vh] w-full rounded-md border border-border object-contain"
            />
          ) : kind === "pdf" ? (
            <iframe
              src={fileUrl}
              title="Submission preview"
              className="h-[60vh] w-full rounded-md border border-border"
            />
          ) : (
            <OpenLink url={fileUrl} isUrl={kind === "url"} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OpenLink({ url, isUrl }: { url: string; isUrl: boolean }) {
  return (
    <div className="space-y-3">
      {isUrl && (
        <p className="text-sm text-muted-foreground break-all">{url}</p>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" className="w-full">
          <ExternalLink className="w-4 h-4 mr-2" />
          {isUrl ? "Open link" : "Open file"}
        </Button>
      </a>
    </div>
  );
}
