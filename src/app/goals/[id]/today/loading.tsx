import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="mt-3 h-6 w-1/2" />
        <SkeletonBlock className="mt-2 h-4 w-24" />
      </div>
      <div className="flex gap-2 border-b border-rule pb-4">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-md border border-rule p-4">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="mt-2 h-4 w-full" />
            <div className="mt-3 flex gap-2">
              <SkeletonBlock className="h-7 w-16" />
              <SkeletonBlock className="h-7 w-16" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
