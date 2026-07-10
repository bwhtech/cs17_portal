import { useEffect } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { LIVE_LIST_OPTIONS } from "@/lib/liveQuery";

export interface StudentAnnouncement {
  name: string;
  title: string;
  content: string;
  alert_variant: string;
  is_dismissible: number;
  published_date: string | null;
}

interface Response {
  announcements: StudentAnnouncement[];
  next_publish_on: string | null;
}

function msUntil(datetime: string): number {
  return new Date(datetime.replace(" ", "T")).getTime() - Date.now();
}

export function useStudentAnnouncements(cohort?: string) {
  const { data, isLoading, mutate } = useFrappeGetCall<{ message: Response }>(
    "cs17_portal.api.get_student_announcements",
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
    announcements: data?.message?.announcements ?? [],
    isLoading,
    mutate,
  };
}
