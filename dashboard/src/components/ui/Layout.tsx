import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";

export default function Layout() {
  const currentUser = (window as any).frappe_boot?.current_user;

  useEffect(() => {
    if (!currentUser || currentUser === "Guest") {
      window.location.href = "/login?redirect-to=/dashboard";
    }
  }, [currentUser]);

  if (!currentUser || currentUser === "Guest") {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}