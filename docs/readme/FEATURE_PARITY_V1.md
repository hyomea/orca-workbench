# Mobile feature parity design v1

Status: target design with a usable manual increment. [Workbench projects](WORKBENCH.md#shared-scenarios-parity-and-rework) documents the implemented feature/work-item/task flow, versioned shared scenarios, iOS/Android evidence, fix tasks, review gates, and explicit specification publication. The richer discovery artifacts, automated source intake, implementation assessments, and role handoffs below remain planned. The current UI combines parity and tests and uses manual references; this document is not a claim that every target capability is implemented.

## Purpose and scope

Help an operator take a feature from an initial idea or existing requirements through iOS and Android implementation and verification. Acceptance criteria and design references are shared inputs when available, and reviewed outputs of discovery when starting from an idea. Each feature connects its problem, decisions, source material, requirements, implementation observations, scenarios, results, and follow-up tasks.

The first version supports two feature entry paths, an optional primary Jira issue, reference material, iOS and Android repository mappings, AI-assisted drafts, manual corrections, and evidence review. A locally authored AC or design can form the reviewed standard without first being published to Jira. Existing project objectives and task workflows remain available. My focus, automatic Jira updates, automatic device orchestration, and shared-code architecture changes are outside this version.

## Inputs and outputs

| Input                           | Intake behavior                                                                                                                         | Result                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Idea or user problem            | Describe the user, situation, pain point, and desired outcome in Chinese or English; attach available feedback.                         | An editable feature brief with assumptions and open questions.                                  |
| Jira issue and AC               | Select a configured Jira site and issue, or paste issue text with a source link. Preview the imported content.                          | A source snapshot and draft requirements with references to the original AC.                    |
| Design documents or screenshots | Add document excerpts and links, local images, or supported Jira images. Label their role as design reference or observed app behavior. | A shared reference set, with specific requirements linked to a section or image.                |
| iOS and Android repositories    | Select from project directories and map each to its platform; permit multiple directories per platform.                                 | Implementation observations tied to paths and revisions, including explicit gaps in inspection. |
| Test conditions                 | Supply fixtures, environment, account role, device/OS, and app build as needed for a run. Store account references, not passwords.      | Reproducible test conditions and separate results for each platform.                            |
| Operator decisions              | Confirm requirements, resolve conflicts, and approve intentional differences.                                                           | A versioned baseline for analysis, tasks, and verification.                                     |

A URL alone is a reference, not evidence that its content has been read. If an integration cannot retrieve the document or an AC field is unavailable, request pasted content and label the source incomplete. Do not silently scan unrelated Jira comments or linked pages as requirements.

Imported Jira AC and design references, or locally authored AC and design explicitly confirmed by the operator, supply the common standard. Imported source snapshots stay intact; local corrections are recorded as decisions or proposed changes, not silently written back to Jira. Generated interpretations require review. If an AC contradicts a design, create a clarification instead of selecting a winner. A screenshot can establish visible layout and content; it cannot by itself establish navigation, calculations, permissions, or failure behavior. Label additional AI-proposed edge cases as suggestions until confirmed.

## Information architecture

Retain **Projects** as the top-level entry. Each project exposes **Features** and the existing **Tasks** view. Each feature opens a full detail page; use a side panel for an individual requirement, source, scenario, or result rather than placing the whole workflow in a long side panel.

Feature list rows show the title, optional Jira key, workflow stage, baseline state, iOS/Android verification summary, unresolved questions, and last assessment time. Use counts such as “4 of 6 applicable requirements verified” and show exclusions separately. Keep task completion metrics distinct from parity verification.

### Feature page

The header contains the feature name, optional primary Jira link, platform repository mappings, and baseline version. A stage strip shows **Explore → Define → Build → Verify → Accepted**; it describes workflow position, not a percentage. A persistent notice identifies unresolved decisions or source changes. Show one primary action appropriate to the current step.

Within Shared context, use sections for **Brief**, **Options**, **AC**, **Design**, and **Decisions**. Existing requirements populate AC and Design directly; an idea begins in Brief. Keep these artifacts editable alongside discussion rather than making chat history the only record. Parity and Tests remain accessible before implementation, with honest empty states.

A compact activity area shows the responsible role, current step, output links, blockers, and next handoff. Opening a role's run shows its session and execution details. Progress is based on actual task/run events and reviewed artifacts, not simulated activity.

| Tab            | Main content                                                                              | Primary action                       |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| Shared context | Brief, options, AC and design sources, confirmed requirements, decisions, shared fixtures | Explore direction or review baseline |
| Parity         | Requirement rows with side-by-side iOS/Android observations and verification status       | Analyze implementations              |
| Tests          | Shared scenarios, platform execution steps, run results, and evidence                     | Record test run                      |

“Create task” is a contextual action on a confirmed gap or failed result. It creates a local Workbench task linked to the feature and affected requirements; it does not create or update a Jira issue. Tasks remain accessible through the project's existing task view.

### Parity page wireframe

Illustrative values below are fixture data, not findings about an existing product.

```text
Projects / Mobile app / Event report
DEMO-123  Baseline v1   iOS: ios-app   Android: android-app

Shared context     [Parity]     Tests

2 of 3 applicable requirements verified on both platforms
                                               [Analyze implementations]
Requirement            iOS                    Android              Follow-up
AC-1 Sold count        Implemented            Implemented
                       Verified               Verified
AC-2 Remaining count   Implemented            Partial              Open gap
                       Not verified           Not verified
AC-3 Empty state       Implemented            Implemented
                       Verified               Verified

Select AC-2 → requirement detail panel
  Expected behavior / Jira AC excerpt / design reference
  iOS observation + source locations / Android observation + locations
  Shared scenario S-2 / iOS: Failed / Android: Not run / evidence
  Clarifications / accepted differences / linked tasks
                                                    [Create task]
```

Use existing typography, neutral surfaces, tabs, tables, badges, and Sheet primitives from the Orca design system. Status must be readable as text rather than color alone. On narrow windows, display each requirement as a card containing both platform sections; keep its reference and requirement identity visible while comparing them.

## Features and change work

Use **Project → Feature → Work item → Task**. The feature holds the shared capability and published specification history. Initial delivery, bug, improvement, and needs-triage items have independent scope, status, evidence notes, tasks, and history. A bug fixes behavior against an existing expectation; an improvement proposes changed behavior. A needs-triage item captures uncertainty before classification.

Bugs begin with reproduction and expected behavior. Improvements revisit only affected requirements, design, and scenarios. Each change references its original specification version. Publishing an accepted initial delivery or improvement is a separate action; planned changes never silently become the current specification. A distinct user goal can instead become a related feature.

## End-to-end workflow

### Two entry paths

**Start with an idea** creates a feature inside the selected project, with a short description and optional references. The operator need not supply Jira, AC, designs, or repository mappings yet. This is distinct from the existing project-creation idea flow: it defines a feature within a project.

**Use existing requirements** imports a Jira issue or pasted AC and design material. The Analyst checks gaps and contradictions, then enters definition review. It does not require another discovery exercise when the problem and direction are already clear. Partial requirements can use the exploration steps only where necessary. Both paths lead to the same feature record and versioned baseline.

### Stages and handoffs

| Step                      | Lead and collaborators                                                             | Concrete output                                                                                                                 | Next action                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Frame the problem      | Product Analyst with the operator                                                  | Brief covering the user, situation, problem, desired outcome, constraints, exclusions, and unknowns                             | Review the brief inline; explore a direction once the problem is understood.                  |
| 2. Explore a solution     | Product Designer with Analyst; platform Engineers advise where feasibility matters | A user flow and low-fidelity design; meaningful alternatives only where a tradeoff exists; assumptions to test                  | Operator chooses or adjusts the direction and first-version scope.                            |
| 3. Define shared behavior | Analyst owns AC; Designer owns design; QA and Engineers review                     | AC linked to flows and states, annotated design, allowed platform differences, scenario drafts, feasibility notes, and blockers | Operator confirms the ready scope as baseline v1.                                             |
| 4. Plan the work          | Platform Engineers assess their repositories; QA checks scenario coverage          | AC-to-implementation comparison, platform tasks, shared-resource tasks, test plan, owners, and dependencies                     | Preview the plan and explicitly start the selected work.                                      |
| 5. Implement              | iOS and Android Engineers; shared-resource owner where needed                      | Code changes, platform tests, self-test evidence, unresolved issues, and a handoff to QA                                        | Independent tasks can run concurrently after shared prerequisites are ready.                  |
| 6. Verify and compare     | Parity QA in a separate review run                                                 | Results against common scenarios, evidence per platform, intentional differences, and routed defects                            | Fix implementation failures or resolve requirement questions, then retest affected scenarios. |
| 7. Accept the result      | Operator, supported by QA's report                                                 | Acceptance of the identified scope and builds, documented exclusions, and follow-up work                                        | Mark the feature Accepted. Merge, publishing, and release remain separate actions.            |

Exploration may use a disposable prototype on one platform to test an interaction. Label it as a prototype and record what was learned; do not count it as production implementation or verified parity. User testing and research findings must identify actual observations. Agent opinion is a hypothesis, not evidence of customer validation.

### Operator decisions

Use three substantive review points: **Choose direction**, **Confirm development baseline**, and **Accept result**. Review the actual brief, design, AC, or evidence at each point, with concise unresolved questions and proposed choices. Routine artifact generation, code inspection, and checks within a started task do not require repeated confirmations. Work launches remain explicit in v1; a completed run does not automatically start an unreviewed chain of agents.

Imported requirements can go directly to baseline confirmation after completeness review. A small, clear feature can combine direction and baseline review. Confirm ready requirements individually so unanswered questions do not prevent unrelated work; clearly exclude unresolved scope from launched tasks and prohibit full acceptance while required criteria remain unresolved.

A development baseline is ready when the selected scope has testable AC, sufficient design or a confirmed existing interaction pattern, recorded platform applicability, reviewed test scenarios, and no blocking product ambiguity. Planning must identify any missing repositories, environment, or device access; affected tasks remain blocked until their prerequisites are available. Full visual design is not mandatory for a change with no new UI.

### Feedback and rework

- A failed test with clear expected behavior returns to the relevant platform Engineer, with the scenario, actual result, build, and evidence.
- An ambiguous AC returns to the Analyst; an unclear interaction returns to the Designer. QA and Engineers may propose a correction but cannot silently redefine expected behavior to make an implementation pass.
- A new product direction returns to exploration or definition. Show the proposed change and affected requirements, tasks, and evidence before confirming a new baseline.
- Existing runs retain their original context snapshot. Mark affected runs as using an older baseline and prevent new dependent work from launching against it. Offer stop/restart explicitly; changing the stage must not claim to have terminated a live agent.
- A failed or interrupted run preserves committed artifacts and draft progress. Retry against an explicit input version; never equate process exit with successful handoff.

## Agent roles and coordination

Roles describe responsibilities, not permanently running processes or mandatory model choices. Start with five role templates using the existing configurable agent selection. A person can supply or review any artifact manually when an agent or required capability is unavailable.

| Role             | Owns                                                                              | Handoff                                                              |
| ---------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Product Analyst  | Problem brief, AC, clarification tracking, source traceability                    | Reviewed product context for Designer, Engineers, and QA             |
| Product Designer | User flow, low-fidelity design, state coverage, platform-specific presentation    | Design references and interaction expectations linked to AC          |
| iOS Engineer     | iOS assessment, implementation, platform tests, self-test evidence                | Revision/build, change summary, AC coverage, test output, known gaps |
| Android Engineer | Android assessment, implementation, platform tests, self-test evidence            | The equivalent Android handoff against the same baseline             |
| Parity QA        | Scenario coverage, independent verification, evidence review, discrepancy routing | Reproducible per-platform findings and an acceptance recommendation  |

Analyst and Designer collaborate on a shared baseline; neither can approve their generated draft on the operator's behalf. QA contributes before development and verifies afterward. Engineer self-tests remain visible but do not become independent QA evidence merely by changing the role label. QA should inspect outputs and execute or review actual tests in a separate run. Without device or environment access, record Blocked or a limited code review, never a passing runtime test.

Assign one writer for each shared artifact or resource per task. Parallel platform work uses isolated workspaces or explicitly non-overlapping ownership. Shared fixture, contract, or asset changes are separate owned tasks when needed; dependent tasks wait for their confirmed version. Do not assume launching multiple agents alone makes concurrent edits safe.

Every run receives a structured handoff: feature ID, baseline and artifact versions, role and task scope, relevant AC/scenario IDs, target workspace and allowed changes, dependencies, expected outputs, and completion criteria. It returns output references, covered requirements, checks actually performed, limitations, blockers, and the proposed next handoff. Preserve the full session for inspection while showing a concise activity summary.

Workbench coordinates the workflow through stored stages, task dependencies, artifact versions, and explicit launch/review actions. A Manager Agent is not required in v1. Reuse task states for Todo, Running, Blocked, Review, and Accepted; show feature stage and individual run state separately. Stopping, retrying, or accepting one run must not silently change another platform's status.

## States and evidence rules

Keep these dimensions separate:

| Dimension                 | Values                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Requirement review        | Draft, Needs clarification, Confirmed                                                     |
| Platform applicability    | Required, Not applicable with reviewed reason                                             |
| Implementation assessment | Unknown, Missing, Partial, Implemented; proposed or reviewed                              |
| Scenario result           | Not run, Passed, Failed, Blocked                                                          |
| Requirement verification  | Not verified, Needs review, Verified; derived from scenario coverage and reviewed results |

An accepted platform difference describes an alternative expected behavior; it is not automatically an exclusion or a passing result. Link it to the requirement, platform, rationale, and reviewer. Test the approved alternative where applicable.

A requirement is verified on a platform only when its baseline is confirmed, all required mapped scenarios have current passing results, and the evidence has been reviewed. Missing scenarios, missing evidence, blocked tests, or unreviewed results cannot produce Verified. Manual and automated evidence are both allowed, with their origin recorded.

Both platforms must satisfy their applicable expected outcomes. Matching behavior alone cannot establish correctness. Show a feature as verified only when all required criteria are verified on every applicable platform and no required clarification remains. Show any excluded platform coverage next to that result.

Keep historical results immutable. Results reference the requirement/scenario versions, build or source revision, environment, device/OS, and data fixture version. Compare runs only when their relevant preconditions are compatible; otherwise show why comparison is unavailable. Results from an older build remain evidence for that build, not automatically for the current one.

Source refresh is explicit in v1. Preserve the current snapshot if a source becomes unavailable. Show source changes for review; retain the approved baseline until changes are accepted. Accepting a change creates a new baseline version and marks affected assessments and verification as Needs review. If impact cannot be determined, conservatively flag the feature. Never delete earlier evidence or silently rewrite an in-flight task's instructions.

## Shared material

Each feature owns one reusable context bundle: source snapshots, confirmed requirements, design references, decisions, scenarios, and fixtures. Both platform tasks reference the same bundle version, with platform-specific instructions added at launch. Potential code or asset reuse can be recorded as an assessment; v1 does not require a common implementation language or test driver.

Design images and actual test screenshots are distinct asset types. Keep their source, version, caption, and linked requirements visible. Retain imported assets in profile-owned storage rather than depending on the original desktop path. Preview images directly; AI image interpretation requires an image-capable provider path and must show which images were included. If unavailable, permit manual annotation and text-based analysis without claiming image inspection.

## Minimal data model

| Record              | Essential fields and links                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Feature             | Project ID, title, entry path, workflow stage, optional Jira site/key, platform repository IDs, active baseline version          |
| Definition artifact | Brief, option, flow, or design; version, author/role, source references, review state                                            |
| Decision            | Direction, scope, clarification, or acceptance; affected artifact versions, reviewer, rationale, timestamp                       |
| Source snapshot     | Kind, origin, imported time, available source revision, content hash, text or managed asset reference                            |
| Requirement         | Stable ID, version, expected behavior, source references, review state, platform applicability, differences                      |
| Baseline            | Version, confirmed requirement versions, source snapshots, decisions, reviewer and timestamp                                     |
| Platform assessment | Requirement version, platform, implementation state, observations, source locations/revision, inspection limits, review metadata |
| Scenario            | Stable ID and version, requirement links, preconditions, actions, expected outcomes, fixture references, platform steps          |
| Test run and result | Platform, scenario version, baseline version, build, environment, device/OS, fixture version, outcome, evidence, reviewer        |
| Feature task link   | Existing task ID, feature ID, requirement/scenario IDs, target platform, launch context version                                  |

Use local reviewer attribution for audit history, not as a claim of multi-user authorization. Existing Projects ownership and access rules still apply. Drafts and interrupted analysis should survive closing the feature page and restarting the application; restore the last saved draft, never imply an interrupted analysis completed. Use atomic persistence and revision checks; stale editors must reconcile rather than overwrite newer records.

## Implementation fit and delivery slices

Reuse the current project navigation, linked repositories, roles, tasks, launch intent snapshots, and review workflow. Reuse `jiraGetIssueForTarget` and existing Jira media display paths for source intake. The current issue mapping must be checked for the selected site's AC custom field; description import or pasted AC is the fallback. Jira image display support does not establish image-capable AI analysis.

Keep the current project-objective discovery flow separate from feature analysis: its output is an objective draft, not requirement coverage or test evidence. Introduce structured feature-analysis results and bounded source collection with explicit repository/revision provenance. Design assets require persistent attachment storage beyond temporary Jira image references.

1. **Manual vertical slice:** both entry paths, feature stages, brief and design artifacts, decisions, Jira/text and design intake, source snapshots, reviewed requirements, two-platform matrix, scenarios, manual evidence, and linked tasks. Preserve current project data through a tested schema migration.
2. **AI assistance:** role templates for problem framing, flow/design drafts, AC normalization, scenario suggestions, and bounded platform assessments. Use supported design/prototype tools and preserve their reviewable outputs. Add image analysis only with a verified provider path. Review changes before replacing confirmed records.
3. **Execution integration:** prepare versioned feature context for existing agent launches, owned shared-resource tasks, prerequisite checks, explicit handoffs, and linked test output. Automatic device orchestration remains a later extension.

## First-version acceptance checks

- Start from a plain-language idea without Jira or repositories, produce a brief and reviewed design/AC, and reach the same baseline workflow as an imported issue.
- Import complete requirements without repeating unnecessary exploration; retain unresolved questions for partial input.
- Hand the same baseline to both Engineers, preserve independent platform status, and block only tasks whose prerequisites are missing.
- Route an implementation failure to its Engineer and a requirement ambiguity back to definition; retain evidence and mark affected work for review.
- Import or paste a Jira issue and attach a design screenshot; every confirmed requirement can be traced to its sources or an explicit operator decision.
- Record an AC/design conflict; neither platform receives a verified status for the unresolved requirement.
- Compare one implemented and one missing platform behavior without converting AI observations into test results.
- Define one shared scenario, record separate platform results, and trace both back to the same baseline.
- Record an intentional native difference with its own expectation and evidence, without hiding it as parity completion.
- Update a requirement or scenario; retain historical evidence while making affected current verification require review.
- Close and reopen the page, restart the app, or encounter a failed analysis/save without silently losing the last saved feature draft.
- Create a linked Workbench task using the existing role and launch workflow; Jira remains unchanged.
- Verify migration, revision conflicts, status derivation, and stale evidence with focused tests; review component fixtures in light/dark themes and narrow windows before implementation handoff.
