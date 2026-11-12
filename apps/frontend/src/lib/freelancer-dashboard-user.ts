import { cache } from "react";

import { loadBoundedCurrentUser } from "@/lib/bounded-current-user";
import { getCurrentUserContext } from "@/lib/current-user";

const DASHBOARD_CURRENT_USER_TIMEOUT_MS = 8_000;

// React request caching shares this route-gate lookup between the dashboard
// layout and page without changing authentication behavior.
export const getFreelancerDashboardGate = cache(() => loadBoundedCurrentUser(
  (signal) => getCurrentUserContext({ signal, throwOnFailure: true }),
  DASHBOARD_CURRENT_USER_TIMEOUT_MS,
));
