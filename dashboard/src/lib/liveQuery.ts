import type { SWRConfiguration } from "swr";

// Poll so server-side scheduled publishes (assignments, grades) surface without a manual refresh.
export const LIVE_LIST_OPTIONS: SWRConfiguration = {
  refreshInterval: 45000,
  revalidateOnFocus: true,
};
