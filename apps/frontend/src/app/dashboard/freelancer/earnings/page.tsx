import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getFinancialHistoryAction } from "@/app/work-assignments/actions";
import { FinancialHistory } from "@/components/dashboard/financial-history";

export default async function EarningsPage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "freelancer") redirect("/auth/login");
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-8 lg:px-8">
      <FinancialHistory initialData={await getFinancialHistoryAction()} accessToken={session.accessToken} refreshButtonClassName="dark:!border-border dark:!bg-card dark:!text-foreground dark:hover:!bg-muted dark:hover:!text-foreground" />
    </main>
  );
}
