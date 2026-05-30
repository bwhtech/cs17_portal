import dayjs from "dayjs";

export function formatDateTime(dateStr: string): string {
  return dayjs(dateStr).format("MMM D, h:mm A");
}

export function formatDate(dateStr: string): string {
  return dayjs(dateStr).format("MMM D");
}