import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PUBLISH_MODES = [
  { value: "draft", label: "Save as Draft" },
  { value: "now", label: "Publish Now" },
  { value: "schedule", label: "Schedule" },
];

interface Props {
  publish: string;
  onPublishChange: (value: string) => void;
  publishOn: string;
  onPublishOnChange: (value: string) => void;
  includeDraft?: boolean;
  hint?: string;
}

// Shared "Publishing" control: a mode select (Draft / Publish Now / Schedule)
// plus the Publish On datetime picker revealed while scheduling.
export default function PublishScheduleFields({
  publish,
  onPublishChange,
  publishOn,
  onPublishOnChange,
  includeDraft = false,
  hint,
}: Props) {
  const modes = includeDraft
    ? PUBLISH_MODES
    : PUBLISH_MODES.filter((mode) => mode.value !== "draft");

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">Publishing</label>
        <Select value={publish} onValueChange={onPublishChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
      </div>

      {publish === "schedule" && (
        <div>
          <label className="block text-sm font-medium mb-2">Publish On</label>
          <Input
            type="datetime-local"
            value={publishOn}
            onChange={(e) => onPublishOnChange(e.target.value)}
          />
        </div>
      )}
    </>
  );
}
