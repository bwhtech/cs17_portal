import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useAuthGuard() {
  const boot = (window as any).frappe_boot;
  const currentUser: string | undefined = boot?.current_user;
  const profileType: string | undefined = boot?.profile?.profile_type;
  const location = useLocation();

  const isGuest = !currentUser || currentUser === "Guest";

  useEffect(() => {
    if (!isGuest) return;
    // BrowserRouter pathname is relative to the /dashboard basename, so we
    // must prepend it to get the full path Frappe's login can redirect back to.
    const fullPath = "/dashboard" + location.pathname + location.search;
    window.location.replace(`/login?redirect-to=${encodeURIComponent(fullPath)}`);
  }, [isGuest, location]);

  return {
    isGuest,
    isFaculty: profileType === "Faculty",
    isStudent: profileType === "Student",
  };
}
