interface Profile {
  name: string;
  full_name: string;
  profile_type: "Student" | "Faculty";
  cohort: string | null;
  profile_picture: string;
}

export function useCurrentProfile() {
  const boot = (window as any).frappe_boot;
  const profile: Profile | null = boot?.profile ?? null;

  return {
    profile,
    isLoading: false,
    error: null,
  };
}
