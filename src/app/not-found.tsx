import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-medium">Not found</h1>
      <p className="text-sm text-neutral-600">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/goals" className={buttonClass("primary")}>
        Back to your goals
      </Link>
    </main>
  );
}
