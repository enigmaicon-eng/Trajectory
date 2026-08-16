import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
      <ul className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-md border border-neutral-200 p-4">
            <SkeletonBlock className="h-5 w-2/3" />
            <SkeletonBlock className="mt-2 h-4 w-full" />
            <SkeletonBlock className="mt-3 h-3 w-16" />
          </li>
        ))}
      </ul>
    </main>
  );
}
