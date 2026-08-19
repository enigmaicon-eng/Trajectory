import { NavLink } from "@/components/goal/NavLink";
import { GoalMenu } from "@/components/goal/GoalMenu";

// §2.1: one thin persistent bar. The goal title is the Progress link and is
// the largest element in the bar; two peer destinations (Today · Week); a
// quiet ⋯ menu for everything else. No icons, no pills, no badge counts.
export function GoalHeader({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  return (
    <header role="banner" className="border-b border-rule">
      <div className="mx-auto flex h-13 max-w-3xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <NavLink href={`/goals/${goalId}`} exact>
          <span className="truncate font-medium">{goalTitle}</span>
        </NavLink>
        <nav aria-label="Goal" className="flex items-center gap-5">
          <NavLink href={`/goals/${goalId}/today`}>Today</NavLink>
          <NavLink href={`/goals/${goalId}/week`}>Week</NavLink>
          <GoalMenu goalId={goalId} />
        </nav>
      </div>
    </header>
  );
}
