export type MarketplaceRole = "freelancer" | "client" | "admin" | null | undefined;

export function discoveryNavigationForRole(role: MarketplaceRole) {
  if (role === "freelancer") {
    return { label: "Find Companies", mobileLabel: "Search companies", href: "/companies" };
  }

  return { label: "Find Freelancers", mobileLabel: "Search freelancers", href: "/freelancers" };
}
