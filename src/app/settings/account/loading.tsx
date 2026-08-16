import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <div className="flex gap-4">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
      <div>
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="mt-2 h-4 w-48" />
      </div>
      <SkeletonBlock className="h-16 w-full" />
      <SkeletonBlock className="h-10 w-full" />
      <SkeletonBlock className="h-10 w-full" />
    </main>
  );
}
