interface Student {
  name: string;
  full_name: string;
  cohort: string;
  profile_picture: string;
}

export function useCurrentStudent() {
  const boot = (window as any).frappe_boot;
  const student: Student | null = boot?.student ?? null;

  return {
    student,
    isLoading: false,
    error: null,
  };
}