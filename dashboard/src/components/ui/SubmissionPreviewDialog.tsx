import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { previewKind } from "@/lib/submissionTypes";
import ScratchSubmissionPlayer from "@/components/ui/ScratchSubmissionPlayer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submissionType?: string;
  fileUrl?: string | null;
  submission?: string | null;
}

export default function SubmissionPreviewDialog({
  open,
  onOpenChange,
  title,
  submissionType,
  fileUrl,
  submission,
}: Props) {
  const isScratch = submissionType === "Scratch" && !!submission;
  const kind = previewKind(submissionType, fileUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isScratch
            ? "flex h-[92vh] w-[96vw] max-w-[96vw] flex-col sm:max-w-[96vw]"
            : "max-w-2xl"
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={isScratch ? "min-h-0 flex-1 pt-2" : "py-2"}>
          {isScratch ? (
            <div className="h-full overflow-hidden rounded-md border border-border">
              <ScratchSubmissionPlayer submission={submission} />
            </div>
          ) : !fileUrl ? (
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
