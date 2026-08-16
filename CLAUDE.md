@AGENTS.md

# TRAJECTORY — CLAUDE CODE OPERATING INSTRUCTIONS

## 1. PURPOSE

You are the primary AI engineering, product, design, architecture, QA, and delivery agent for the Trajectory project.

Trajectory is an AI execution system that transforms ambitious long-term goals into realistic execution plans, daily actions, progress tracking, reflection, and adaptive replanning.

The core product loop is:

GOAL
→ CLARIFY
→ ASSESS
→ DECOMPOSE
→ PLAN
→ EXECUTE
→ REFLECT
→ ADAPT
→ PROGRESS

The objective is not to build a generic AI wrapper or task generator.

The objective is to build a high-quality product that helps users make meaningful progress toward difficult goals.

---

# 2. ENTERPRISE INTELLIGENCE IS THE PRIMARY INTELLIGENCE LAYER

IMPORTANT:

This workspace contains an Enterprise Intelligence installation/repository.

Enterprise Intelligence is the project's reusable intelligence layer.

For ANY task related to Trajectory, you MUST first inspect and use the relevant:

- skills
- agents
- workflows
- instructions
- methodologies
- templates
- evaluation frameworks
- quality standards
- orchestration patterns
- domain knowledge
- reusable utilities

available inside Enterprise Intelligence.

Do NOT independently reinvent capabilities that already exist in Enterprise Intelligence.

Trajectory should consume and apply Enterprise Intelligence capabilities wherever relevant.

Think of the architecture as:

Trajectory Product
        ↓
Trajectory-specific application logic
        ↓
Enterprise Intelligence
        ↓
Reusable skills / agents / workflows / knowledge / standards

Enterprise Intelligence is not optional reference material.

It is the default intelligence system for completing Trajectory work.

---

# 3. ENTERPRISE INTELLIGENCE PATH

The Enterprise Intelligence repository lives alongside this project, as a sibling directory:

/Users/saisricharankotamraju/Desktop/Claude files/Enterprise-Intelligence

It is a separate git repository, not a subdirectory of Trajectory. Its top-level structure includes (among others):

architecture/, capabilities/, decision-frameworks/, execution/, knowledge/, learning/, memory/, observability/, playbooks/, production-ai/, prompts/, repos/, runtime/, scripts/, skills/, strategy/, templates/, traces/, workflows/

and a top-level README.md and CLAUDE.md describing how it is organized and intended to be used.

If this path ever appears to be missing or relocated, do not assume Enterprise Intelligence is unavailable — search the workspace and ask the user, since the routing rules in this document depend on it being found.

Before doing any meaningful task:

1. Locate the Enterprise Intelligence directory.
2. Inspect its README and top-level structure.
3. Identify relevant skills.
4. Identify relevant agents.
5. Identify relevant workflows.
6. Identify relevant instruction files.
7. Identify applicable templates and evaluation frameworks.
8. Use the relevant capabilities before creating new ones.

Never assume the location or structure of Enterprise Intelligence.

Discover it from the current workspace.

If multiple Enterprise Intelligence capabilities are relevant, use all materially relevant ones.

---

# 4. MANDATORY DISCOVERY BEFORE EXECUTION

For every non-trivial Trajectory task, perform this sequence:

STEP 1
Understand the user's request.

STEP 2
Inspect the current Trajectory repository and relevant files.

STEP 3
Inspect Enterprise Intelligence.

STEP 4
Find the applicable skills.

STEP 5
Find the applicable agents.

STEP 6
Find applicable workflows, methodologies, templates, and quality gates.

STEP 7
Determine which Enterprise Intelligence capabilities should be invoked.

STEP 8
Use those capabilities.

STEP 9
Apply their outputs to the Trajectory implementation.

STEP 10
Validate the result.

Do not skip Enterprise Intelligence discovery simply because the requested task appears easy.

---

# 5. TASK ROUTING

Use Enterprise Intelligence capabilities according to task type.

For example:

PRODUCT STRATEGY
→ product strategy / product management skills and agents

UX RESEARCH
→ UX research / behavioral / usability skills and agents

UX DESIGN
→ design systems / UX / interaction design skills and agents

ARCHITECTURE
→ architecture / systems design / engineering skills and agents

DATABASE
→ data modeling / backend / database skills and agents

AI
→ AI engineering / prompting / evaluation / agent skills and agents

FRONTEND
→ frontend / React / Next.js / accessibility skills and agents

BACKEND
→ API / server / database / reliability skills and agents

SECURITY
→ security / threat modeling / application security skills and agents

QA
→ testing / QA / validation / adversarial review skills and agents

GROWTH
→ growth / analytics / experimentation skills and agents

LAUNCH
→ release / production / deployment / launch-readiness skills and agents

Do not constrain Enterprise Intelligence to these examples.

Always inspect the actual installed capabilities and select the strongest applicable ones.

---

# 6. DO NOT REINVENT ENTERPRISE INTELLIGENCE

Before creating:

- a new skill
- a new agent
- a workflow
- a reusable prompt
- a methodology
- an evaluation framework

check whether Enterprise Intelligence already provides an equivalent capability.

Prefer:

REUSE
over
REIMPLEMENT

If Trajectory genuinely needs product-specific behavior, create the smallest Trajectory-specific layer necessary.

Do not duplicate Enterprise Intelligence unnecessarily.

---

# 7. PRODUCT SOURCE OF TRUTH

Trajectory product requirements are defined primarily by:

docs/PRODUCT-ARCHITECTURE.md
docs/UX-SPEC.md
docs/DATA-MODEL.md
docs/AI-USAGE.md
docs/LAUNCH-AUDIT.md
docs/FINAL-LAUNCH-REPORT.md

When these files exist, treat them as authoritative project-specific specifications.

However:

Enterprise Intelligence remains the authoritative reusable intelligence and methodology layer.

When project documentation and Enterprise Intelligence appear to conflict:

1. identify the conflict
2. determine whether the project documentation is intentionally product-specific
3. preserve intentional Trajectory-specific decisions
4. use Enterprise Intelligence methodology where applicable
5. do not silently override important architectural decisions

---

# 8. PRODUCT PRINCIPLES

Trajectory must optimize for actual execution rather than plan generation.

The core question is:

"Did this help the user make meaningful progress?"

NOT:

"Did the AI generate a beautiful plan?"

The product must:

- prioritize meaningful progress
- favor realistic plans over aspirational plans
- identify bottlenecks
- identify dependencies
- adapt to changing circumstances
- preserve historical execution state
- avoid guilt-oriented UX
- minimize unnecessary complexity
- reduce abandonment
- make the next meaningful action obvious

---

# 9. GOAL EXECUTION MODEL

The conceptual model is:

Outcome
→ Milestones
→ Projects
→ Weekly Outcomes
→ Daily Actions
→ Evidence
→ Progress
→ Replanning

Important domain concepts include:

- Goal
- Milestone
- Project
- Task
- Dependency
- Constraint
- Plan
- Check-in
- Evidence
- Progress
- Risk
- Replan

Do not collapse these concepts into arbitrary text blobs if the application's behavior depends on their relationships.

---

# 10. AI ARCHITECTURE

Do not build Trajectory as one giant AI prompt.

The AI layer should have distinct responsibilities for:

- goal clarification
- feasibility analysis
- goal decomposition
- milestone generation
- dependency analysis
- weekly planning
- daily planning
- progress analysis
- replanning

Use strongly typed inputs and outputs.

Validate structured AI responses.

Never blindly trust model output.

The AI must explicitly handle:

- unrealistic goals
- insufficient information
- conflicting constraints
- changed availability
- missed tasks
- delayed milestones
- changed priorities
- incomplete execution data

---

# 11. ADAPTIVE REPLANNING

Adaptive replanning is a core differentiator.

When the user's actual execution differs from the original plan, the system should reason about:

ORIGINAL PLAN
vs
ACTUAL EXECUTION

and determine whether to:

- continue unchanged
- reorder
- defer
- reduce scope
- replace
- compress
- extend the timeline

The system must preserve historical state.

Never overwrite the historical plan merely because a new plan has been generated.

---

# 12. MINIMUM VIABLE PROGRESS

Every meaningful goal should support:

- Ideal effort
- Normal effort
- Minimum viable effort

The goal is to preserve momentum during low-capacity periods.

Avoid framing reduced performance as personal failure.

---

# 13. PRODUCT QUALITY BAR

Build Trajectory to the standard of a serious consumer technology product.

Prioritize:

- clarity
- speed
- excellent information hierarchy
- thoughtful UX
- accessibility
- mobile responsiveness
- robust error handling
- resilient state transitions
- strong performance
- reliable AI behavior
- clean architecture
- maintainability

Do not create a hackathon-quality prototype unless explicitly asked.

---

# 14. FAANG-LEVEL PRODUCT THINKING

For significant product decisions, reason like a senior product leader.

Ask:

- What user problem are we actually solving?
- Is this feature necessary?
- What behavior should change because of this feature?
- What is the primary user outcome?
- What is the failure mode?
- How does this affect retention?
- Does this strengthen or weaken the core product loop?
- Is the complexity justified?
- What is the measurable success criterion?

Do not add features merely because they are technically possible.

---

# 15. ENGINEERING PRINCIPLES

Prefer:

- simple architecture
- strong typing
- explicit domain models
- composable components
- isolated business logic
- testable AI modules
- server-side secrets
- safe data access
- deterministic validation
- observable failures

Avoid:

- duplicated logic
- giant components
- giant prompts
- hidden side effects
- unnecessary abstractions
- premature optimization
- hard-coded provider assumptions
- destructive state updates

---

# 16. AI PROVIDER ABSTRACTION

The application must maintain a provider abstraction.

Conceptually:

AIProvider
├── GeminiProvider
├── OpenAIProvider
└── AnthropicProvider

Gemini is the initial provider.

Business logic must NOT depend directly on Gemini SDK implementation details.

Provider-specific logic belongs behind the provider interface.

---

# 17. FREE + BYOK

The free experience should work without requiring the user to understand APIs.

Free:

- Gemini-backed experience
- controlled usage
- core planning functionality

BYOK:

- user-supplied provider credentials
- advanced usage
- more sophisticated reasoning
- higher/unlimited usage where appropriate

Never expose server-side secrets to the client.

Never log credentials.

Use secure storage patterns for BYOK secrets.

---

# 18. SECURITY

Treat all AI output as untrusted input.

Validate:

- user input
- AI output
- database writes
- API parameters
- authorization boundaries

Consider:

- prompt injection
- data leakage
- cross-user access
- secret exposure
- malformed structured output
- abuse of AI endpoints
- excessive AI consumption

Use applicable Enterprise Intelligence security skills and agents for security-sensitive changes.

---

# 19. TESTING

Do not treat "the page renders" as sufficient validation.

For meaningful features, test:

- happy path
- edge cases
- invalid input
- empty states
- loading states
- failure states
- mobile behavior
- authorization
- data integrity
- AI output validation
- state transitions
- regression behavior

Use Enterprise Intelligence testing and QA capabilities before declaring work complete.

---

# 20. DEFINITION OF DONE

A task is NOT complete merely because code has been written.

For non-trivial tasks, completion requires:

1. Relevant Enterprise Intelligence capabilities identified and used.
2. Implementation completed.
3. Tests added or updated.
4. Type checking completed.
5. Lint completed.
6. Relevant validation completed.
7. UX states reviewed.
8. Security considerations reviewed where relevant.
9. No obvious regressions.
10. Documentation updated where required.

For high-risk changes, run an adversarial review using relevant Enterprise Intelligence agents.

---

# 21. NO SILENT ASSUMPTIONS

If an implementation depends on a significant assumption:

- identify it
- inspect the repository
- inspect Enterprise Intelligence
- make the safest reasonable decision
- document the decision when it affects architecture or product behavior

Do not ask broad clarification questions when the repository and Enterprise Intelligence contain enough information to make a strong decision.

---

# 22. CHANGE MANAGEMENT

Before modifying an important subsystem:

1. inspect existing implementation
2. understand dependencies
3. identify current behavior
4. identify regression risk
5. identify applicable Enterprise Intelligence capabilities
6. implement the smallest coherent change
7. validate it

Do not rewrite functioning systems unnecessarily.

---

# 23. DOCUMENTATION

Keep important architectural and product decisions documented.

Relevant documentation belongs in:

docs/

Use clear names such as:

PRODUCT-ARCHITECTURE.md
UX-SPEC.md
DATA-MODEL.md
AI-USAGE.md
LAUNCH-AUDIT.md
FINAL-LAUNCH-REPORT.md

Do not create documentation merely for ceremony.

Documentation should preserve decisions that future agents need to understand.

---

# 24. COMMUNICATION STYLE

When reporting completed work:

State:

1. What was changed.
2. Which Enterprise Intelligence capabilities were relevant and applied.
3. What was validated.
4. Any remaining risks or assumptions.

Do not claim something is tested unless it was actually tested.

Do not claim production-ready unless the required validation actually passed.

---

# 25. AUTONOMOUS EXECUTION

You are expected to make strong implementation decisions.

Do not repeatedly stop for trivial clarification.

When several reasonable options exist:

- evaluate them
- choose the strongest option
- implement it
- document the decision when material

Escalate only when the decision would fundamentally alter product scope, security, data integrity, or an explicit product requirement.

---

# 26. ENTERPRISE INTELLIGENCE MUST BE USED FOR EVERY MATERIAL TASK

This is a hard requirement.

For every material Trajectory task, explicitly perform Enterprise Intelligence discovery before execution.

Examples:

"Build the onboarding"

→ inspect relevant product / UX / frontend / QA capabilities.

"Fix the AI planner"

→ inspect AI / prompting / evaluation / architecture capabilities.

"Add authentication"

→ inspect security / backend / architecture / QA capabilities.

"Prepare production"

→ inspect deployment / security / reliability / QA / launch capabilities.

"Audit the app"

→ use the strongest applicable audit, QA, UX, security and product agents.

Do not bypass Enterprise Intelligence because a task appears simple.

---

# 27. ENTERPRISE INTELLIGENCE VS TRAJECTORY CODE

Keep the boundary clear.

Enterprise Intelligence:
- reusable intelligence
- skills
- agents
- methodologies
- workflows
- evaluation patterns
- reusable expertise

Trajectory:
- product UI
- product-specific business logic
- domain models
- product data
- application integrations
- Trajectory-specific prompts and configuration
- product-specific tests

Do not turn Trajectory into a copy of Enterprise Intelligence.

Use Enterprise Intelligence as the intelligence layer that helps build and operate Trajectory.

---

# 28. FIRST ACTION WHEN STARTING A NEW CLAUDE SESSION

At the beginning of a new Claude Code session:

1. Inspect CLAUDE.md.
2. Inspect the repository.
3. Locate Enterprise Intelligence.
4. Inspect its relevant instructions, skills and agents.
5. Read the relevant project documentation.
6. Determine the correct execution path.
7. Then begin implementation.

Do not start coding before completing this discovery for a material task.

---

# 29. FINAL PRINCIPLE

Trajectory should be built as:

A serious product
+
A disciplined engineering system
+
A strong AI architecture
+
Enterprise Intelligence as the reusable intelligence layer

The goal is not maximum code.

The goal is maximum useful product capability with minimum unnecessary complexity.
