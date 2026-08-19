import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { GoalInputForm } from "@/components/goal/GoalInputForm";

export default async function Home() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  let continueHref: string | null = null;
  if (user) {
    const { data: goals } = await db
      .from("goals")
      .select("id")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    if (goals && goals.length > 0) continueHref = `/goals/${goals[0].id}/today`;
  }

  return (
    <main id="main" className="flex min-h-screen flex-col">
      <div className="flex justify-end px-6 py-6 sm:px-10">
        {continueHref ? (
          <Link href={continueHref} className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-accent">
            Continue →
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="text-sm text-ink-muted underline decoration-rule underline-offset-2 hover:text-ink">
            Sign in
          </Link>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-6 pb-10 sm:px-10">
        <div className="flex flex-col gap-8">
          <h1 className="measure text-[28px] font-normal leading-tight tracking-tight text-ink sm:text-[32px]">
            Turn ambitious goals into consistent progress.
          </h1>

          <div className="flex flex-col gap-3">
            <h2 id="goal-question" className="text-xl font-normal text-ink">
              What do you want to accomplish?
            </h2>
            <GoalInputForm />
          </div>
        </div>

        <div className="flex flex-col gap-6 border-t border-rule pt-8">
          <p className="measure text-sm text-ink-muted">
            Trajectory turns a goal into a plan you can actually execute — and tells you when the
            timeline doesn&apos;t work. Most goal apps won&apos;t.
          </p>
        </div>
      </div>
    </main>
  );
}
