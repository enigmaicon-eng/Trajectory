import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <div className="flex gap-4">
          <SkeletonBlock className="h-4 w-14" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-14" />
        </div>
        <SkeletonBlock className="mt-3 h-6 w-1/2" />
        <SkeletonBlock className="mt-2 h-4 w-3/4" />
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-6">
        <SkeletonBlock className="h-6 w-40" />
        <div className="flex gap-6">
          <SkeletonBlock className="h-8 w-20" />
          <SkeletonBlock className="h-8 w-20" />
        </div>
      </div>
      <ol className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-md border border-neutral-200 p-4">
            <SkeletonBlock className="h-5 w-2/3" />
            <SkeletonBlock className="mt-2 h-4 w-full" />
          </li>
        ))}
      </ol>
    </main>
  );
}
