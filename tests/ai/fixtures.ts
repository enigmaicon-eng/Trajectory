// §5.8 evaluation harness: ~12 golden goal fixtures across domains, including
// two deliberately unrealistic and one vague. Each fixture pairs a module
// input with a *recorded* (hand-authored, representative) raw model output —
// no live provider calls. eval.test.ts runs each recorded output through the
// real schema + `applyInvariants` for its module and asserts structure, not
// prose, per §5.8.
import type { ClarifyInput } from "@/lib/ai/modules/clarify/input.schema";
import type { ClarifyOutput } from "@/lib/ai/modules/clarify/output.schema";
import type { AssessInput } from "@/lib/ai/modules/assess/input.schema";
import type { AssessOutput } from "@/lib/ai/modules/assess/output.schema";
import type { DecomposeInput } from "@/lib/ai/modules/decompose/input.schema";
import type { DecomposeOutput } from "@/lib/ai/modules/decompose/output.schema";
import { addWeeks, horizonEnd } from "@/lib/domain/dates";

const CAPACITY = { idealMinutes: 90, normalMinutes: 60, minimumMinutes: 20, daysPerWeek: 5 } as const;
const START = "2026-01-05"; // a Monday — see dates.ts's Monday-aligned week boundaries

/** A date `weeks` into a horizon starting at `start`, guaranteed inside [start, horizonEnd]. */
function at(start: string, weeks: number): string {
  return addWeeks(start, weeks);
}

export interface GoalFixture {
  id: string;
  domain: string;
  description: string;
  clarify: { input: ClarifyInput; recorded: ClarifyOutput };
  assess?: { input: AssessInput; recorded: AssessOutput };
  decompose?: { input: DecomposeInput; startDate: string; recorded: DecomposeOutput };
}

export const fixtures: GoalFixture[] = [
  // 1 — flagship case (AC-2.4): ambitious but possible, full chain.
  {
    id: "career-pm-flagship",
    domain: "career",
    description: "Become a PM at a top tech company within 12 months, 5h/week, no PM experience",
    clarify: {
      input: { rawInput: "I want to become a PM at a top tech company within 12 months" },
      recorded: {
        title: "Become a PM at a top tech company",
        outcomeStatement: "Land a Product Manager role at a top-tier tech company",
        domain: "career",
        targetDate: null,
        horizonWeeks: 52,
        questions: [
          { id: "q1", prompt: "How many hours per week can you realistically commit?" },
          { id: "q2", prompt: "Do you have any adjacent experience (eng, design, data)?" },
        ],
      },
    },
    assess: {
      input: {
        rawInput: "I want to become a PM at a top tech company within 12 months",
        outcomeStatement: "Land a Product Manager role at a top-tier tech company",
        domain: "career",
        targetDate: null,
        horizonWeeks: 52,
        answers: { q1: "5 hours/week", q2: "No PM experience, background in customer support" },
      },
      recorded: {
        verdict: "ambitious_but_possible",
        confidence: 0.55,
        rationale:
          "Breaking into PM without prior product experience in 12 months at 5h/week is aggressive but achievable with a focused portfolio and networking strategy.",
        keyRisks: [
          { risk: "No portfolio of product work", severity: "high", mitigation: "Ship 2 side projects with documented decisions" },
          { risk: "Limited weekly hours", severity: "medium", mitigation: "Prioritize high-leverage networking over passive learning" },
        ],
        comparableBasis: "Career switchers into PM typically take 9-18 months with a dedicated portfolio",
        alternative: null,
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Land a Product Manager role at a top-tier tech company",
        domain: "career",
        targetDate: null,
        horizonWeeks: 52,
        feasibilityVerdict: "ambitious_but_possible",
        feasibilityRationale: "Aggressive but achievable with a focused portfolio and networking strategy.",
        constraints: [{ kind: "time", label: "5 hours per week", isHard: true }],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Build a PM portfolio", summary: "Two shipped case studies", verification: "2 published case studies with measurable outcomes", targetDate: at(START, 13), sequence: 0 },
          { tempId: "m2", title: "Build a PM network", summary: "Informational interviews", verification: "15+ informational interviews logged", targetDate: at(START, 26), sequence: 1 },
          { tempId: "m3", title: "Pass PM interview loops", summary: "Product sense, execution, behavioral", verification: "Completed 3 mock loops scoring 'strong hire'", targetDate: at(START, 39), sequence: 2 },
          { tempId: "m4", title: "Land offer", summary: "Signed offer", verification: "Signed offer letter for a PM role", targetDate: horizonEnd(START, 52), sequence: 3 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Ship case study #1", summary: null, verification: "Published write-up with metrics", estimatedMinutes: 3000, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m1", title: "Ship case study #2", summary: null, verification: "Published write-up with metrics", estimatedMinutes: 3000, sequence: 1 },
          { tempId: "p3", milestoneTempId: "m2", title: "Run 15 informational interviews", summary: null, verification: "15 logged conversations with notes", estimatedMinutes: 2400, sequence: 0 },
          { tempId: "p4", milestoneTempId: "m3", title: "Complete mock interview loops", summary: null, verification: "3 mock loops with written feedback", estimatedMinutes: 2400, sequence: 0 },
          { tempId: "p5", milestoneTempId: "m4", title: "Apply and interview", summary: null, verification: "Signed offer letter", estimatedMinutes: 2400, sequence: 0 },
        ],
        dependencies: [
          { fromTempId: "p1", toTempId: "p3", type: "informs", rationale: "Case studies strengthen networking conversations" },
          { fromTempId: "p3", toTempId: "p4", type: "blocks", rationale: "Network contacts often refer to interview loops" },
          { fromTempId: "p4", toTempId: "p5", type: "blocks", rationale: "Must pass mocks before real loops" },
        ],
      },
    },
  },

  // 2 — career, deliberately contains a dependency cycle (AC-3.8 repair path).
  {
    id: "career-cyclic-deps",
    domain: "career",
    description: "Switch from support into software engineering — recorded output has a cyclic blocks edge",
    clarify: {
      input: { rawInput: "I want to switch from customer support into software engineering" },
      recorded: {
        title: "Switch into software engineering",
        outcomeStatement: "Land a junior software engineering role",
        domain: "career",
        targetDate: null,
        horizonWeeks: 40,
        questions: [{ id: "q1", prompt: "What's your current technical background, if any?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Land a junior software engineering role",
        domain: "career",
        targetDate: null,
        horizonWeeks: 40,
        feasibilityVerdict: "ambitious_but_possible",
        feasibilityRationale: "Achievable with consistent study and a portfolio.",
        constraints: [],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Learn core fundamentals", summary: null, verification: "Complete a fundamentals course with graded exercises", targetDate: at(START, 13), sequence: 0 },
          { tempId: "m2", title: "Build a portfolio", summary: null, verification: "3 deployed projects on GitHub", targetDate: at(START, 26), sequence: 1 },
          { tempId: "m3", title: "Interview prep", summary: null, verification: "Pass 3 mock technical interviews", targetDate: horizonEnd(START, 40), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Complete fundamentals course", summary: null, verification: "Certificate + graded exercises", estimatedMinutes: 4000, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Ship project A", summary: null, verification: "Deployed with a README", estimatedMinutes: 3000, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m2", title: "Ship project B", summary: null, verification: "Deployed with a README", estimatedMinutes: 3000, sequence: 1 },
          { tempId: "p4", milestoneTempId: "m3", title: "Run mock interviews", summary: null, verification: "3 mocks with written feedback", estimatedMinutes: 2000, sequence: 0 },
        ],
        dependencies: [
          // p2 blocks p3, p3 blocks p4, p4 blocks p2 — a genuine cycle.
          { fromTempId: "p2", toTempId: "p3", type: "blocks", rationale: "Project A patterns reused in project B" },
          { fromTempId: "p3", toTempId: "p4", type: "blocks", rationale: "Portfolio must exist before interview prep" },
          { fromTempId: "p4", toTempId: "p2", type: "blocks", rationale: "Model error — not a real constraint" },
        ],
      },
    },
  },

  // 3 — skill domain, normal decompose.
  {
    id: "skill-spanish-fluency",
    domain: "skill",
    description: "Reach conversational Spanish fluency",
    clarify: {
      input: { rawInput: "I want to become conversationally fluent in Spanish" },
      recorded: {
        title: "Reach conversational Spanish fluency",
        outcomeStatement: "Hold unscripted 15-minute conversations in Spanish",
        domain: "skill",
        targetDate: null,
        horizonWeeks: 26,
        questions: [{ id: "q1", prompt: "Any prior Spanish exposure?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Hold unscripted 15-minute conversations in Spanish",
        domain: "skill",
        targetDate: null,
        horizonWeeks: 26,
        feasibilityVerdict: "realistic",
        feasibilityRationale: "Well within reach with consistent daily practice.",
        constraints: [],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Core vocabulary and grammar", summary: null, verification: "Pass a 1000-word vocabulary quiz", targetDate: at(START, 9), sequence: 0 },
          { tempId: "m2", title: "Listening comprehension", summary: null, verification: "Follow a native-speed podcast episode unaided", targetDate: at(START, 18), sequence: 1 },
          { tempId: "m3", title: "Speaking practice", summary: null, verification: "10 logged conversation-partner sessions", targetDate: horizonEnd(START, 26), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Complete vocabulary curriculum", summary: null, verification: "1000-word quiz passed at 90%+", estimatedMinutes: 2500, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Weekly podcast shadowing", summary: null, verification: "Log of 10 completed episodes", estimatedMinutes: 2000, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Conversation partner sessions", summary: null, verification: "10 sessions logged with notes", estimatedMinutes: 3000, sequence: 0 },
        ],
        dependencies: [{ fromTempId: "p1", toTempId: "p3", type: "blocks", rationale: "Need base vocabulary before real conversation" }],
      },
    },
  },

  // 4 — business domain, deliberately dangling project + far-over-budget effort
  // (AC-3.7 drop-to-exactly-3 path, AC-3.10 downscale repair).
  {
    id: "business-dangling-project",
    domain: "business",
    description: "Launch a small SaaS product — recorded output has a dangling project and 3x over-budget effort",
    clarify: {
      input: { rawInput: "I want to launch a small SaaS product" },
      recorded: {
        title: "Launch a small SaaS product",
        outcomeStatement: "Launch a paying SaaS product with real customers",
        domain: "business",
        targetDate: null,
        horizonWeeks: 20,
        questions: [{ id: "q1", prompt: "Do you have a specific problem or customer in mind?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Launch a paying SaaS product with real customers",
        domain: "business",
        targetDate: null,
        horizonWeeks: 20,
        feasibilityVerdict: "ambitious_but_possible",
        feasibilityRationale: "Achievable at a small scope with disciplined prioritization.",
        constraints: [],
        capacity: CAPACITY,
      },
      recorded: {
        // 4 milestones; m4's only project references an unknown milestone
        // (dangling), so m4 ends up with zero valid projects and gets
        // dropped — leaving exactly 3, the invariant-repair floor.
        milestones: [
          { tempId: "m1", title: "Validate the idea", summary: null, verification: "10 problem-validation interviews", targetDate: at(START, 6), sequence: 0 },
          { tempId: "m2", title: "Build an MVP", summary: null, verification: "Deployed MVP with core flow working", targetDate: at(START, 13), sequence: 1 },
          { tempId: "m3", title: "Get first paying customers", summary: null, verification: "3 paying customers", targetDate: horizonEnd(START, 20), sequence: 2 },
          { tempId: "m4", title: "Orphaned milestone", summary: null, verification: "Never reached — its only project is dangling", targetDate: horizonEnd(START, 20), sequence: 3 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Run validation interviews", summary: null, verification: "10 logged interviews", estimatedMinutes: 12000, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Build MVP core flow", summary: null, verification: "Deployed and demoable", estimatedMinutes: 14000, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Sell to first customers", summary: null, verification: "3 signed customers", estimatedMinutes: 10000, sequence: 0 },
          // References a milestone tempId that doesn't exist — dangling.
          { tempId: "p4", milestoneTempId: "m-unknown", title: "Ghost project", summary: null, verification: "n/a", estimatedMinutes: 5000, sequence: 0 },
        ],
        dependencies: [
          { fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "Validate before building" },
          { fromTempId: "p2", toTempId: "p3", type: "blocks", rationale: "Need a working product before selling" },
        ],
      },
    },
  },

  // 5 — fitness domain, normal decompose.
  {
    id: "fitness-marathon",
    domain: "fitness",
    description: "Run a marathon",
    clarify: {
      input: { rawInput: "I want to run a marathon" },
      recorded: {
        title: "Run a marathon",
        outcomeStatement: "Finish a marathon",
        domain: "fitness",
        targetDate: null,
        horizonWeeks: 20,
        questions: [{ id: "q1", prompt: "What's your current weekly running volume?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Finish a marathon",
        domain: "fitness",
        targetDate: horizonEnd(START, 20),
        horizonWeeks: 20,
        feasibilityVerdict: "realistic",
        feasibilityRationale: "Standard 20-week marathon buildup from a light running base.",
        constraints: [{ kind: "hard_date", label: `Race day ${horizonEnd(START, 20)}`, isHard: true }],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Build aerobic base", summary: null, verification: "Comfortably run 10k", targetDate: at(START, 7), sequence: 0 },
          { tempId: "m2", title: "Build long-run endurance", summary: null, verification: "Complete a 20-mile long run", targetDate: at(START, 17), sequence: 1 },
          { tempId: "m3", title: "Taper and race", summary: null, verification: "Finish the marathon", targetDate: horizonEnd(START, 20), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Base-building block", summary: null, verification: "10k comfortably", estimatedMinutes: 3000, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Long-run progression", summary: null, verification: "20-mile long run completed", estimatedMinutes: 4500, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Taper block + race", summary: null, verification: "Marathon finisher", estimatedMinutes: 1500, sequence: 0 },
        ],
        dependencies: [{ fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "Base must exist before long runs" }],
      },
    },
  },

  // 6 — finance domain, normal decompose.
  {
    id: "finance-emergency-fund",
    domain: "finance",
    description: "Build a 6-month emergency fund",
    clarify: {
      input: { rawInput: "I want to build a 6-month emergency fund" },
      recorded: {
        title: "Build a 6-month emergency fund",
        outcomeStatement: "Save 6 months of essential expenses in a liquid account",
        domain: "finance",
        targetDate: null,
        horizonWeeks: 40,
        questions: [{ id: "q1", prompt: "What are your monthly essential expenses?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Save 6 months of essential expenses in a liquid account",
        domain: "finance",
        targetDate: null,
        horizonWeeks: 40,
        feasibilityVerdict: "realistic",
        feasibilityRationale: "Achievable with a consistent automated savings rate.",
        constraints: [{ kind: "money", label: "$400/month available to save", isHard: true }],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Set up the system", summary: null, verification: "Automated transfer configured", targetDate: at(START, 2), sequence: 0 },
          { tempId: "m2", title: "Reach 3 months saved", summary: null, verification: "Balance = 3x monthly expenses", targetDate: at(START, 26), sequence: 1 },
          { tempId: "m3", title: "Reach 6 months saved", summary: null, verification: "Balance = 6x monthly expenses", targetDate: horizonEnd(START, 40), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Open high-yield savings + automate transfer", summary: null, verification: "Recurring transfer active", estimatedMinutes: 500, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Track spending, cut one recurring cost", summary: null, verification: "One subscription cancelled, tracked monthly", estimatedMinutes: 3000, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Sustain the savings rate", summary: null, verification: "6 consecutive months of on-target transfers", estimatedMinutes: 2500, sequence: 0 },
        ],
        dependencies: [{ fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "System must exist before tracking against it" }],
      },
    },
  },

  // 7 — project domain, normal decompose.
  {
    id: "project-write-novel",
    domain: "project",
    description: "Write a first draft of a novel",
    clarify: {
      input: { rawInput: "I want to write a first draft of a novel" },
      recorded: {
        title: "Write a novel first draft",
        outcomeStatement: "Complete an 80,000-word first draft",
        domain: "project",
        targetDate: null,
        horizonWeeks: 30,
        questions: [{ id: "q1", prompt: "Do you have an outline or are you starting from scratch?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Complete an 80,000-word first draft",
        domain: "project",
        targetDate: null,
        horizonWeeks: 30,
        feasibilityVerdict: "realistic",
        feasibilityRationale: "About 615 words/day — comfortable within stated capacity.",
        constraints: [],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Outline complete", summary: null, verification: "Chapter-by-chapter outline document", targetDate: at(START, 3), sequence: 0 },
          { tempId: "m2", title: "First half drafted", summary: null, verification: "40,000 words written", targetDate: at(START, 15), sequence: 1 },
          { tempId: "m3", title: "Full draft complete", summary: null, verification: "80,000-word draft, start to finish", targetDate: horizonEnd(START, 30), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Write chapter outline", summary: null, verification: "Outline document reviewed by self", estimatedMinutes: 1200, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Draft chapters 1-15", summary: null, verification: "40,000 words in manuscript", estimatedMinutes: 6000, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Draft chapters 16-30", summary: null, verification: "80,000 words in manuscript", estimatedMinutes: 6000, sequence: 0 },
        ],
        dependencies: [
          { fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "Need an outline before drafting" },
          { fromTempId: "p2", toTempId: "p3", type: "blocks", rationale: "Sequential chapters" },
        ],
      },
    },
  },

  // 8 — "other" domain, effort under budget (AC-3.10 upscale repair path).
  {
    id: "other-side-project-underscoped",
    domain: "other",
    description: "Build a personal website — recorded effort is well under the capacity budget",
    clarify: {
      input: { rawInput: "I want to build a personal website" },
      recorded: {
        title: "Build a personal website",
        outcomeStatement: "Launch a personal website with a bio and project list",
        domain: "other",
        targetDate: null,
        horizonWeeks: 8,
        questions: [],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Launch a personal website with a bio and project list",
        domain: "other",
        targetDate: null,
        horizonWeeks: 8,
        feasibilityVerdict: "realistic",
        feasibilityRationale: "Small, well-scoped project.",
        constraints: [],
        capacity: CAPACITY,
      },
      recorded: {
        // budget = 8 * 90 * 5 = 3600m; total here is 600m — well under the
        // 25% tolerance band, exercising the upscale branch.
        milestones: [
          { tempId: "m1", title: "Design and content", summary: null, verification: "Content drafted, layout sketched", targetDate: at(START, 3), sequence: 0 },
          { tempId: "m2", title: "Build and deploy", summary: null, verification: "Site live at a public URL", targetDate: at(START, 6), sequence: 1 },
          { tempId: "m3", title: "Polish", summary: null, verification: "Mobile-checked, no broken links", targetDate: horizonEnd(START, 8), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Write bio and project blurbs", summary: null, verification: "Content doc finalized", estimatedMinutes: 200, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Build and deploy the site", summary: null, verification: "Live URL", estimatedMinutes: 300, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Cross-device polish pass", summary: null, verification: "Checked on mobile + desktop", estimatedMinutes: 100, sequence: 0 },
        ],
        dependencies: [{ fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "Content needed before building pages" }],
      },
    },
  },

  // 9 — career, second decompose case with a tighter horizon.
  {
    id: "career-negotiate-raise",
    domain: "career",
    description: "Negotiate a promotion and raise",
    clarify: {
      input: { rawInput: "I want to get promoted and negotiate a raise this cycle" },
      recorded: {
        title: "Get promoted and negotiate a raise",
        outcomeStatement: "Earn a promotion with a corresponding raise this review cycle",
        domain: "career",
        targetDate: horizonEnd(START, 16),
        horizonWeeks: 16,
        questions: [{ id: "q1", prompt: "When is your next formal review?" }],
      },
    },
    decompose: {
      startDate: START,
      input: {
        outcomeStatement: "Earn a promotion with a corresponding raise this review cycle",
        domain: "career",
        targetDate: horizonEnd(START, 16),
        horizonWeeks: 16,
        feasibilityVerdict: "ambitious_but_possible",
        feasibilityRationale: "Plausible if a promotion packet is built early and consistently.",
        constraints: [{ kind: "hard_date", label: `Review cycle closes ${horizonEnd(START, 16)}`, isHard: true }],
        capacity: CAPACITY,
      },
      recorded: {
        milestones: [
          { tempId: "m1", title: "Build the promotion case", summary: null, verification: "Written packet with quantified impact", targetDate: at(START, 6), sequence: 0 },
          { tempId: "m2", title: "Get manager alignment", summary: null, verification: "Manager confirms sponsorship in writing/verbally", targetDate: at(START, 11), sequence: 1 },
          { tempId: "m3", title: "Formal review and negotiation", summary: null, verification: "Signed new offer/comp letter", targetDate: horizonEnd(START, 16), sequence: 2 },
        ],
        projects: [
          { tempId: "p1", milestoneTempId: "m1", title: "Document quantified impact", summary: null, verification: "Packet with metrics reviewed by a peer", estimatedMinutes: 2000, sequence: 0 },
          { tempId: "p2", milestoneTempId: "m2", title: "Run alignment conversations", summary: null, verification: "Manager sponsorship confirmed", estimatedMinutes: 1500, sequence: 0 },
          { tempId: "p3", milestoneTempId: "m3", title: "Prepare and run negotiation", summary: null, verification: "Signed updated comp letter", estimatedMinutes: 1000, sequence: 0 },
        ],
        dependencies: [
          { fromTempId: "p1", toTempId: "p2", type: "blocks", rationale: "Need the case before asking for sponsorship" },
          { fromTempId: "p2", toTempId: "p3", type: "blocks", rationale: "Need sponsorship before the formal ask" },
        ],
      },
    },
  },

  // 10 — deliberately unrealistic #1 (AC-2.5).
  {
    id: "career-surgeon-6-months",
    domain: "career",
    description: "Become a surgeon in 6 months at 3h/week — deliberately unrealistic",
    clarify: {
      input: { rawInput: "I want to become a surgeon in 6 months" },
      recorded: {
        title: "Become a surgeon",
        outcomeStatement: "Become a practicing surgeon",
        domain: "career",
        targetDate: null,
        horizonWeeks: 26,
        questions: [{ id: "q1", prompt: "What's your current medical background, if any?" }],
      },
    },
    assess: {
      input: {
        rawInput: "I want to become a surgeon in 6 months",
        outcomeStatement: "Become a practicing surgeon",
        domain: "career",
        targetDate: null,
        horizonWeeks: 26,
        answers: { q1: "No medical background, 3 hours/week available" },
      },
      recorded: {
        verdict: "unrealistic_as_stated",
        confidence: 0.97,
        rationale:
          "Becoming a licensed surgeon requires a bachelor's degree, 4 years of medical school, and 5+ years of residency — a minimum of roughly a decade of full-time training. 6 months at 3h/week cannot satisfy licensure requirements under any circumstance.",
        keyRisks: [{ risk: "Hard licensure requirements cannot be compressed", severity: "high", mitigation: "Reframe toward an achievable adjacent or long-horizon goal" }],
        comparableBasis: "Surgical licensure timelines are regulated and consistently span 10+ years",
        alternative: {
          outcomeStatement: "Shadow and informationally interview surgeons to validate interest in medicine, then apply to a post-bacc pre-med program",
          horizonWeeks: 26,
          whyStronger: "Achievable in the stated window and is the real first step on the only path to this outcome",
        },
      },
    },
  },

  // 11 — deliberately unrealistic #2 (AC-2.5), different domain.
  {
    id: "skill-cpa-six-weeks",
    domain: "skill",
    description: "Pass the CPA exam in 6 weeks with no accounting background at 2h/week — deliberately unrealistic",
    clarify: {
      input: { rawInput: "I want to pass the CPA exam in 6 weeks" },
      recorded: {
        title: "Pass the CPA exam",
        outcomeStatement: "Pass all four sections of the CPA exam",
        domain: "skill",
        targetDate: null,
        horizonWeeks: 6,
        questions: [{ id: "q1", prompt: "What's your accounting background?" }],
      },
    },
    assess: {
      input: {
        rawInput: "I want to pass the CPA exam in 6 weeks",
        outcomeStatement: "Pass all four sections of the CPA exam",
        domain: "skill",
        targetDate: null,
        horizonWeeks: 6,
        answers: { q1: "No accounting background, 2 hours/week" },
      },
      recorded: {
        verdict: "unrealistic_as_stated",
        confidence: 0.93,
        rationale:
          "Candidates with an accounting degree typically study 300-400 hours across all four CPA sections. At 2h/week, 6 weeks provides 12 hours — roughly 3% of typical prep time — with no accounting foundation to build on.",
        keyRisks: [{ risk: "Study hours are two orders of magnitude short", severity: "high", mitigation: "Extend the horizon and build foundational accounting knowledge first" }],
        comparableBasis: "Public CPA exam pass-rate data assumes 300-400 prep hours per candidate",
        alternative: {
          outcomeStatement: "Complete an introductory financial accounting course and pass one CPA section",
          horizonWeeks: 26,
          whyStronger: "Builds the prerequisite foundation and targets one section within a realistic study budget",
        },
      },
    },
  },

  // 12 — vague goal (AC-1.1's ≤4 question cap, enforced at the schema boundary).
  {
    id: "other-vague-life-goal",
    domain: "other",
    description: "Vague input — 'get my life together'",
    clarify: {
      input: { rawInput: "I want to get my life together" },
      recorded: {
        title: "Get my life together",
        outcomeStatement: "Establish stable routines across health, finances, and work",
        domain: "other",
        targetDate: null,
        horizonWeeks: null,
        questions: [
          { id: "q1", prompt: "Which area feels most urgent: health, money, work, or relationships?" },
          { id: "q2", prompt: "What does 'together' look like in 90 days?" },
          { id: "q3", prompt: "How many hours per week can you commit?" },
          { id: "q4", prompt: "What's worked before, even briefly?" },
        ],
      },
    },
  },
];
