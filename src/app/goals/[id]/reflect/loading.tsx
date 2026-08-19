import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <div className="flex gap-4">
          <SkeletonBlock className="h-4 w-14" />
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
        <SkeletonBlock className="mt-3 h-6 w-1/2" />
        <SkeletonBlock className="mt-2 h-4 w-1/3" />
      </div>
      <div className="flex gap-6 border-b border-rule pb-6">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-16" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
    </main>
  );
}
