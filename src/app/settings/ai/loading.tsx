import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <SkeletonBlock className="h-4 w-40" />
      <div>
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="mt-2 h-4 w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} className="h-16 w-full" />
      ))}
    </main>
  );
}
