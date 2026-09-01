interface Student {
  name: string;
  full_name: string;
  cohort: string;
  profile_picture: string;
}

export function useCurrentStudent() {
  const boot = (window as any).frappe_boot;
  const profile = boot?.profile;
  const student: Student | null =
    profile?.profile_type === "Student" ? profile : null;

  return {
    student,
    isLoading: false,
    error: null,
  };
}