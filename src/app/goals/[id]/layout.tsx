import { GoalKeyboardShortcuts } from "@/components/goal/GoalKeyboardShortcuts";

export default async function GoalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: goalId } = await params;
  return (
    <>
      {children}
      <GoalKeyboardShortcuts goalId={goalId} />
    </>
  );
}
