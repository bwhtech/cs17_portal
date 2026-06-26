interface Faculty {
  name: string;
  full_name: string;
  profile_picture: string;
}

export function useCurrentFaculty() {
  const boot = (window as any).frappe_boot;
  const faculty: Faculty | null = boot?.faculty ?? null;

  return {
    faculty,
    isLoading: false,
    error: null,
  };
}
