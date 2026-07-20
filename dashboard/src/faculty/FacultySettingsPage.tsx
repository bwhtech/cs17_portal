import { useState } from "react";
import FacultyProfileCard from "@/faculty/FacultyProfileCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

export default function FacultySettingsPage() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  async function handleLogout() {
    await fetch("/api/method/logout", {
      method: "POST",
      headers: {
        "X-Frappe-CSRF-Token": (window as any).csrf_token,
      },
    });
    window.location.href = "/login";
  }

  return (
    <div className="p-6 max-w-lg space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
          Profile
        </h2>
        <FacultyProfileCard />
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
          Appearance
        </h2>
        <div className="border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark theme
            </p>
          </div>
          <button
            role="switch"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              padding: 3,
              transition: "background 0.2s",
              backgroundColor: theme === "dark" ? "#18181b" : "#d4d4d8",
              display: "flex",
              alignItems: "center",
              justifyContent: theme === "dark" ? "flex-end" : "flex-start",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "#fff",
                display: "block",
                transition: "all 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
          Account
        </h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-muted transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Log out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
