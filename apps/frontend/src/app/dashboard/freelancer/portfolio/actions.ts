"use server";

import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";

export type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string;
  createdAt: string;
};

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createPortfolioItemAction(input: {
  title: string;
  url: string;
}): Promise<ActionResult<PortfolioItem>> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") {
    return { success: false, error: "You need to be logged in as a freelancer." };
  }

  const title = input.title.trim();
  const url = input.url.trim();
  if (!title) return { success: false, error: "A title is required." };
  if (!isHttpUrl(url)) return { success: false, error: "Enter a valid HTTP or HTTPS URL." };

  try {
    const item = await backendFetch<PortfolioItem>("/freelancers/me/portfolio", {
      method: "POST",
      accessToken: session.accessToken,
      body: { title, url, type: "link" },
    });
    return { success: true, data: item };
  } catch {
    return { success: false, error: "We couldn't add this portfolio item. Please try again." };
  }
}

export async function deletePortfolioItemAction(itemId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") {
    return { success: false, error: "You need to be logged in as a freelancer." };
  }

  try {
    await backendFetch(`/freelancers/me/portfolio/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      accessToken: session.accessToken,
    });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "We couldn't delete this portfolio item. Please try again." };
  }
}
