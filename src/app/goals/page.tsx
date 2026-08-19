import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { buttonClass } from "@/components/ui/button-styles";

// §14.12: with exactly one goal (the free-tier norm), this route is skipped
// entirely — the header's title link and daily routing go straight to the
// goal. It only renders for the (BYOK) multi-goal case, or genuinely zero.
export default async function GoalsPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=%2Fgoals");

  const { data: goals } = await db
    .from("goals")
    .select("id, title, outcome_statement, status, created_at")
    .order("created_at", { ascending: false });

  if (goals && goals.length === 1) {
    redirect(`/goals/${goals[0].id}/today`);
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">Your goals</h1>
        <Link href="/settings/account" className="text-sm text-ink-muted underline decoration-rule underline-offset-2 hover:text-ink">
          Account
        </Link>
      </div>
      {!goals || goals.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">You don&apos;t have a goal yet. Start with the outcome, not the steps.</p>
          <Link href="/" className={`self-start ${buttonClass("primary")}`}>
            Start a goal
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col">
          {goals.map((goal) => (
            <li key={goal.id} className="border-b border-rule py-4 last:border-b-0">
              <Link href={`/goals/${goal.id}/today`} className="text-base font-medium text-ink hover:text-accent">
                {goal.title}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">{goal.outcome_statement}</p>
              <span className="mt-2 inline-block text-xs uppercase tracking-wide text-ink-faint">{goal.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
