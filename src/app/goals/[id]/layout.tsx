import { GoalKeyboardShortcuts } from "@/components/goal/GoalKeyboardShortcuts";
import { GoalHeader } from "@/components/goal/GoalHeader";
import { createClient } from "@/lib/db/server";

export default async function GoalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: goalId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  // Unauthenticated visits are redirected by each page's own auth check;
  // the header just degrades to a bare shell rather than duplicating that
  // check here (goal title isn't readable pre-auth anyway, RLS-wise).
  const { data: goal } = user
    ? await db.from("goals").select("title").eq("id", goalId).maybeSingle()
    : { data: null };

  return (
    <>
      {goal && <GoalHeader goalId={goalId} goalTitle={goal.title} />}
      {children}
      <GoalKeyboardShortcuts goalId={goalId} />
    </>
  );
}
