import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <h1 className="text-xl font-medium">Your goals</h1>
      {!goals || goals.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No goals yet. <a href="/" className="underline">Start one</a>.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((goal) => (
            <li key={goal.id} className="rounded-md border border-neutral-200 p-4">
              <p className="font-medium">{goal.title}</p>
              <p className="mt-1 text-sm text-neutral-600">{goal.outcome_statement}</p>
              <span className="mt-2 inline-block text-xs uppercase tracking-wide text-neutral-500">
                {goal.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
