import { useEffect } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { LIVE_LIST_OPTIONS } from "@/lib/liveQuery";

export interface StudentAssignment {
  name: string;
  title: string;
  due_date: string;
  max_marks: number;
  assignment_type: string;
  submission_type: string;
  modified: string;
}

interface Response {
  assignments: StudentAssignment[];
  next_publish_on: string | null;
}

function msUntil(datetime: string): number {
  return new Date(datetime.replace(" ", "T")).getTime() - Date.now();
}

export function useStudentAssignments(cohort?: string) {
  const { data, isLoading, mutate } = useFrappeGetCall<{ message: Response }>(
    "cs17_portal.api.get_student_assignments",
    { cohort },
    cohort ? undefined : null,
    LIVE_LIST_OPTIONS,
  );

  const nextPublishOn = data?.message?.next_publish_on ?? null;
  useEffect(() => {
    if (!nextPublishOn) return;
    const delay = msUntil(nextPublishOn);
    const timer = setTimeout(() => mutate(), Math.max(delay, 0) + 500);
    return () => clearTimeout(timer);
  }, [nextPublishOn, mutate]);

  return {
    assignments: data?.message?.assignments ?? [],
    isLoading,
    mutate,
  };
}
