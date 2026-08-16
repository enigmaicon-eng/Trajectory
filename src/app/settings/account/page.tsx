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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <nav className="flex gap-4 text-sm text-neutral-500">
        <a href="/goals" className="underline">
          ← Your goals
        </a>
        <a href="/settings/ai" className="underline">
          AI settings
        </a>
      </nav>
      <div>
        <h1 className="text-xl font-medium">Account</h1>
        <p className="mt-2 text-sm text-neutral-600">{user.email}</p>
      </div>
      <AccountSettingsForm
        initialDisplayName={profile?.display_name ?? ""}
        initialTimezone={profile?.timezone ?? "UTC"}
        tier={profile?.tier ?? "free"}
      />
    </main>
  );
}
