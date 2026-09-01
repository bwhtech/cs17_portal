import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useZenMode } from "@/context/ZenModeContext";

export function ZenToggleButton() {
  const { isZen, toggleZen } = useZenMode();
  const label = isZen ? "Exit zen mode" : "Zen mode";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleZen}
      title={label}
      aria-label={label}
    >
      {isZen ? (
        <Minimize2 className="w-4 h-4" />
      ) : (
        <Maximize2 className="w-4 h-4" />
      )}
    </Button>
  );
}
