import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <div className="flex gap-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-14" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <SkeletonBlock className="mt-3 h-6 w-1/2" />
        <SkeletonBlock className="mt-2 h-4 w-3/4" />
      </div>
      <div className="flex gap-8 border-b border-neutral-200 pb-6">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-24" />
        ))}
      </div>
      <ol className="flex flex-col gap-6">
        {[0, 1].map((i) => (
          <li key={i} className="rounded-md border border-neutral-200 p-4">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="mt-2 h-4 w-full" />
            <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
