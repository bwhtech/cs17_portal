import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import FacultySidebar from "@/faculty/FacultySidebar";
import FacultyTopBar from "@/faculty/FacultyTopBar";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";
import { useZenMode } from "@/context/ZenModeContext";

export default function FacultyLayout() {
  const { isGuest, isFaculty } = useAuthGuard();
  const { isZen } = useZenMode();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isGuest) return null;
  if (!isFaculty) return <Navigate to="/" replace />;

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {!isZen && <FacultySidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {!isZen && <FacultyTopBar onMenuClick={() => setMobileNavOpen(true)} />}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
