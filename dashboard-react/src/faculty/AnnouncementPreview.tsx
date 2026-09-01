import ReactMarkdown from "react-markdown";
import { X } from "lucide-react";
import { alertStyles } from "@/components/ui/AlertBanner";
import { cn } from "@/lib/utils";

export interface AnnouncementDraft {
  title: string;
  content: string;
  alert_variant: string;
  is_dismissible: boolean | number;
}

export default function AnnouncementPreview({
  draft,
}: {
  draft: AnnouncementDraft;
}) {
  const s = alertStyles[draft.alert_variant as keyof typeof alertStyles] ?? alertStyles.info;
  return (
    <div className={cn("flex items-start gap-4 rounded-xl px-5 py-4", s.wrapper)}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          s.iconBg,
        )}
      >
        {s.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", s.title)}>
          {draft.title || "Announcement title"}
        </p>
        {draft.content && (
          <div className={cn("text-xs mt-0.5", s.body)}>
            <ReactMarkdown>{draft.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {Boolean(draft.is_dismissible) && (
        <X className={cn("w-4 h-4 shrink-0 mt-0.5", s.dismiss)} />
      )}
    </div>
  );
}
