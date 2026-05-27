import { Outlet } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";

export default function Layout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left sidebar */}
      <Sidebar />

      {/* Right side — topbar + page content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}