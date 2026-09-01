import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AnnouncementPreview, {
  type AnnouncementDraft,
} from "@/faculty/AnnouncementPreview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: AnnouncementDraft | null;
}

export default function PreviewAnnouncementDialog({
  open,
  onOpenChange,
  announcement,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>How students will see this announcement.</DialogDescription>
        </DialogHeader>
        {announcement && <AnnouncementPreview draft={announcement} />}
      </DialogContent>
    </Dialog>
  );
}
