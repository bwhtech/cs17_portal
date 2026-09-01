import { useEffect } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { LIVE_LIST_OPTIONS } from "@/lib/liveQuery";

export interface StudentGrade {
  name: string;
  assignment: string;
  submission: string;
  marks_obtained: number | null;
  grade: string | null;
  evaluation_type: string;
  remarks: string | null;
  is_published: number;
}

interface Response {
  grades: StudentGrade[];
  next_publish_on: string | null;
}

function msUntil(datetime: string): number {
  return new Date(datetime.replace(" ", "T")).getTime() - Date.now();
}

export function useStudentGrades(enabled: boolean = true) {
  const { data, isLoading, mutate } = useFrappeGetCall<{ message: Response }>(
    "cs17_portal.api.get_student_grades",
    undefined,
    enabled ? undefined : null,
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
    grades: data?.message?.grades ?? [],
    isLoading,
    mutate,
  };
}
