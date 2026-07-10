import { type ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type SidebarShellProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export default function SidebarShell({
  mobileOpen,
  onMobileOpenChange,
  children,
}: SidebarShellProps) {
  return (
    <>
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-background flex-col h-screen sticky top-0">
        {children}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 max-w-[80vw] p-0 gap-0 md:hidden"
        >
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
