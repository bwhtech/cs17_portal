import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function formatDateTime(dateStr: string): string {
  return dayjs(dateStr).format("MMM D, h:mm A");
}

export function formatDate(dateStr: string): string {
  return dayjs(dateStr).format("MMM D");
}