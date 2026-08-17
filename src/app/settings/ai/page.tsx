import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { listByokStatus } from "@/lib/security/byok-session";
import { ByokSettingsForm } from "@/components/settings/ByokSettingsForm";

export default async function AiSettingsPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=%2Fsettings%2Fai");

  const status = await listByokStatus();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <nav aria-label="Settings" className="flex gap-4 text-sm text-neutral-500">
        <Link href="/goals" className="underline">
          ← Your goals
        </Link>
        <Link href="/settings/account" className="underline">
          Account
        </Link>
      </nav>
      <div>
        <h1 className="text-xl font-medium">Provider keys</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Trajectory runs on a shared free tier by default. Add your own key to remove the
          generation limits and use your own quota.
        </p>
      </div>
      <ByokSettingsForm initialStatus={status} />
    </main>
  );
}
