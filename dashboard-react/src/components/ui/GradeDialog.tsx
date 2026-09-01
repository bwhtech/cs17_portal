import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Grade {
  evaluation_type?: string;
  grade?: string;
  marks_obtained?: number;
  remarks?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grade: Grade | null | undefined;
}

export default function GradeDialog({ open, onOpenChange, grade }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grade & Feedback</DialogTitle>
        </DialogHeader>
        {grade ? (
          <div className="space-y-3 py-2">
            {grade.evaluation_type === "Grade" ? (
              <div>
                <p className="text-sm text-muted-foreground">Grade</p>
                <p className="text-2xl font-semibold">{grade.grade ?? "—"}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">Marks Obtained</p>
                <p className="text-2xl font-semibold">{grade.marks_obtained ?? "—"}</p>
              </div>
            )}
            {grade.remarks && (
              <div>
                <p className="text-sm text-muted-foreground">Remarks</p>
                <p className="text-sm">{grade.remarks}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No grade posted yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
