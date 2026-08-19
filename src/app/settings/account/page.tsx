import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";

export default async function AccountSettingsPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=%2Fsettings%2Faccount");

  const { data: profile } = await db
    .from("profiles")
    .select("display_name, timezone, tier")
    .eq("id", user.id)
    .single();

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <nav aria-label="Settings" className="flex gap-4 text-sm text-ink-muted">
        <Link href="/goals" className="underline decoration-rule underline-offset-2 hover:text-ink">
          ← Your goals
        </Link>
        <Link href="/settings/ai" className="underline decoration-rule underline-offset-2 hover:text-ink">
          Provider keys
        </Link>
      </nav>
      <div>
        <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">Account</h1>
        <p className="mt-2 text-sm text-ink-muted">{user.email}</p>
      </div>
      <AccountSettingsForm
        initialDisplayName={profile?.display_name ?? ""}
        initialTimezone={profile?.timezone ?? "UTC"}
        tier={profile?.tier ?? "free"}
      />
    </main>
  );
}
