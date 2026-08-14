import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/goal/OnboardingFlow";
import { commitGoal, getDraftState } from "@/server/actions/goal";

type Choice = "proceed" | "extend" | "narrow";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ choice?: string }>;
}) {
  const { choice } = await searchParams;
  const draft = await getDraftState();

  // Returning from the auth redirect with a previously-chosen fork option —
  // finish the commit now that a session exists. commitGoal() redirects
  // itself (to /goals/[id]/map) on success, so nothing follows this call.
  if (choice && draft?.assessment) {
    await commitGoal({ choice: choice as Choice });
  }

  if (!draft) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <OnboardingFlow initialDraft={draft} />
    </main>
  );
}
