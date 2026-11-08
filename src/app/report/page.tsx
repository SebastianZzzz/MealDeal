import { redirect } from "next/navigation";
import { ReportForm } from "@/features/catalog/report-form";
import { isAuth0Configured } from "@/lib/env";
import { getIdentity } from "@/lib/session";

export default async function ReportPage() {
  // Sharing a price and reading a photo both need an account; ask before the student takes a photo.
  if (isAuth0Configured() && !(await getIdentity())?.sub) redirect("/auth/login?returnTo=/report");
  return <ReportForm />;
}
