import { useSyncExternalStore } from "react";

interface Profile {
  name: string;
  full_name: string;
  first_name: string;
  last_name: string;
  profile_type: "Student" | "Faculty";
  cohort: string | null;
  profile_picture: string;
}

const getBoot = () => (window as any).frappe_boot;

let profile: Profile | null = getBoot()?.profile ?? null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateCurrentProfile(patch: Partial<Profile>) {
  if (!profile) return;
  profile = { ...profile, ...patch };
  if (getBoot()) getBoot().profile = profile;
  listeners.forEach((listener) => listener());
}

export function useCurrentProfile() {
  return {
    profile: useSyncExternalStore(subscribe, () => profile),
    isLoading: false,
    error: null,
  };
}
