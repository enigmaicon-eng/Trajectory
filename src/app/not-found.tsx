export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-medium">Not found</h1>
      <p className="text-sm text-neutral-600">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <a href="/goals" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
        Back to your goals
      </a>
    </main>
  );
}
