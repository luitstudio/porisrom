import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getFinancialHistoryAction } from "@/app/work-assignments/actions";
import { FinancialHistory } from "@/components/dashboard/financial-history";

export default async function ClientPaymentsPage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== "client") redirect("/auth/login");
  return <FinancialHistory initialData={await getFinancialHistoryAction()} accessToken={session.accessToken} clientPresentation />;
}
