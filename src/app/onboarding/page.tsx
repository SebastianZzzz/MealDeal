import { OnboardingForm } from "@/components/onboarding-form";
import { redirect } from "next/navigation";
import { isAuth0Configured } from "@/lib/env";
import { getIdentity } from "@/lib/session";

export default async function OnboardingPage() {
  if (isAuth0Configured() && !(await getIdentity())?.sub) {
    redirect("/auth/login?returnTo=/onboarding");
  }
  return <OnboardingForm />;
}
