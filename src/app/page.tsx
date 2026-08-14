import { GoalInputForm } from "@/components/goal/GoalInputForm";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <h1 className="max-w-xl text-center text-2xl font-medium tracking-tight">
        What do you want to accomplish?
      </h1>
      <GoalInputForm />
    </main>
  );
}
