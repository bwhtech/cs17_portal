// Convert between a native <input type="datetime-local"> value and Frappe's
// "YYYY-MM-DD HH:mm:ss" datetime string.

export function toFrappeDatetime(value: string): string {
  return value ? value.replace("T", " ") + ":00" : "";
}

export function toDatetimeLocal(value?: string | null): string {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}
