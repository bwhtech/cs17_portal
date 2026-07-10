import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";

export default function Layout() {
  const { isGuest, isFaculty } = useAuthGuard();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isGuest) return null;
  if (isFaculty) return <Navigate to="/faculty" replace />;

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
