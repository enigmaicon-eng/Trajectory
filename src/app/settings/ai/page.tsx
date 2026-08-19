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
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <nav aria-label="Settings" className="flex gap-4 text-sm text-ink-muted">
        <Link href="/goals" className="underline decoration-rule underline-offset-2 hover:text-ink">
          ← Your goals
        </Link>
        <Link href="/settings/account" className="underline decoration-rule underline-offset-2 hover:text-ink">
          Account
        </Link>
      </nav>
      <div>
        <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">Provider keys</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Trajectory runs on a shared free tier by default. Add your own key to remove the
          generation limits and use your own quota.
        </p>
      </div>
      <ByokSettingsForm initialStatus={status} />
    </main>
  );
}
