import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";

const isGuest = (user: string | undefined) => !user || user === "Guest";

export default function Layout() {
  const currentUser = (window as any).frappe_boot?.current_user;
  const location = useLocation();

  useEffect(() => {
    if (isGuest(currentUser)) {
      const redirectTo = encodeURIComponent(location.pathname + location.search);
      window.location.replace(`/login?redirect-to=${redirectTo}`);
    }
  }, [currentUser]);

  if (isGuest(currentUser)) return null;

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}