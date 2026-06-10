import { useLayoutEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";

export default function Layout() {
  const currentUser = (window as any).frappe_boot?.current_user;
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (!currentUser || currentUser === "Guest") {
      const intendedPath =
        window.location.pathname.replace("/dashboard", "") || "/";
      const redirectTo = encodeURIComponent(
        `/dashboard?intended=${encodeURIComponent(intendedPath)}`,
      );
      window.location.href = `/login?redirect-to=${redirectTo}`;
      return;
    }

    // After login, Frappe lands on /dashboard?intended=...  — read and restore it
    const params = new URLSearchParams(window.location.search);
    const intended = params.get("intended");
    if (intended) {
      window.history.replaceState({}, "", "/dashboard");
      navigate(intended, { replace: true });
    }
  }, []);

  if (!currentUser || currentUser === "Guest") {
    return null;
  }

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
