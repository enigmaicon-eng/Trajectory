// §0.5 — the most important component in the system. One per primary
// surface, the page's <h1>. Line 1 is always deterministic (passed in as
// plain text by the server component that computed it); line 2 is optional
// AI narrative that may never contradict line 1 and simply doesn't render
// when unavailable — nothing shifts, no placeholder.
export function StandingAnswer({
  line1,
  line2,
}: {
  line1: string;
  line2?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="measure text-[28px] font-normal leading-tight tracking-tight text-ink sm:text-[32px]">
        {line1}
      </h1>
      {line2 && <p className="measure text-base text-ink-muted">{line2}</p>}
    </div>
  );
}
