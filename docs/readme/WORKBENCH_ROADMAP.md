# Orca Workbench roadmap

## Product direction

Make Orca Workbench a platform for developing and verifying feature parity between iOS and Android. Use Jira acceptance criteria and design documents or screenshots as shared context when available; allow ideas to produce locally reviewed AC and design before development. Organize the workflow around three questions: what should behave consistently, what can be shared, and how both implementations will be tested. Web, API, legacy, and internal-tool repositories provide supporting context where relevant.

The [first-version feature parity design](FEATURE_PARITY_V1.md) defines source intake, baseline review, the feature page, platform comparison, and test evidence. It is the target design; the manual delivery and verification loop is implemented as documented in [Workbench projects](WORKBENCH.md#shared-scenarios-parity-and-rework).

Parity means meeting an agreed capability and behavior specification. Native navigation, permissions, presentation, and hardware interactions can differ intentionally. Two implementations behaving the same way is not sufficient if both violate the expected behavior.

The usable manual increment provides feature/work-item records, shared AC and design references, versioned test scenarios, separate iOS/Android result and review states, role-assigned platform tasks, failed-result fix tasks, evidence invalidation after work changes, acceptance gates, and explicit specification publication. Discovery tasks can produce AC before the scope is frozen. Test execution remains in existing platform tools.

The checklist below describes broader targets; unchecked items can be partially implemented. There are no committed release dates.

## Discovery and agent workflow

- [ ] **Provide two feature entry paths.** Start from an idea or import existing Jira AC and design. Both paths converge on a reviewed baseline; a Jira issue is optional during exploration.
- [ ] **Support problem framing and solution design.** Preserve briefs, flows, prototypes, scope choices, assumptions, and decisions as editable artifacts rather than chat-only history.
- [ ] **Add role templates and explicit handoffs.** Product Analyst, Product Designer, iOS Engineer, Android Engineer, and Parity QA operate on versioned inputs and return reviewable outputs. Use stored workflow state and dependencies rather than requiring a Manager Agent.
- [ ] **Make review and rework visible.** Support direction selection, development-baseline confirmation, and final acceptance, with lightweight review for small features. Route defects to implementation and ambiguity to definition; preserve history and flag affected evidence after changes.

## First milestone — define parity per feature

- [ ] **Create a feature record spanning iOS and Android.** Describe the user outcome, relevant workflows, platform implementation locations, and current behavior. Organize around capabilities rather than files, screens alone, or API dependencies.
- [ ] **Define the parity agreement.** Record shared business rules, displayed data and their meaning, permissions, state transitions, error handling, and applicable offline or recovery behavior. Specify which outcomes must match and which native differences are accepted. Keep unresolved requirements visible.
- [ ] **Show a reviewed parity matrix.** Give each platform separate implementation and verification statuses, linked evidence, and build or revision information. Distinguish unknown, missing, partial, implemented, and intentionally different behavior. An AI code scan proposes an assessment; it does not establish verified parity.
- [ ] **Link confirmed gaps to tasks.** Reuse existing roles and tasks for platform changes and verification. Give each task the feature agreement and relevant scenarios as acceptance criteria. Track API work when a feature needs it, without making API readiness the organizing principle of the parity workflow.

Acceptance example: a reporting feature has an agreed definition for seats sold and seats remaining. The feature record compares the meaning and behavior on iOS and Android, identifies any intended differences, and links unresolved gaps to tasks. Existing web behavior is supporting evidence, not an automatic specification.

## Second milestone — make shared material reusable

- [x] **Maintain one shared feature specification.** Keep terminology, business rules, acceptance criteria, and decisions accessible to both platform implementations and their agents. Preserve source references and distinguish observed behavior from confirmed requirements.
- [ ] **Record what can be shared and how.** Classify specifications, test scenarios, fixtures, test data, assets, contracts, and potential code reuse separately. Record the canonical source, consumers, and platform exceptions. Shared behavior does not require shared implementation code; assess code reuse against the existing stacks before choosing an architecture.
- [ ] **Expose changes that need cross-platform review.** When a shared rule, resource, or implementation changes, identify the related feature records, platform tasks, and scenarios for review. Propose updates rather than silently replacing confirmed requirements or invalidating results without explanation.
- [ ] **Supply feature context to agent tasks.** Compose and preview shared project context, the feature agreement, reusable resources, the assigned role, and task acceptance criteria. Snapshot this context for execution and retries. Keep changes in different repositories traceable through separate execution records.

Acceptance example: a business-rule clarification updates a shared specification and fixture. Both platform tasks reference that same material, while platform-specific code and test drivers remain separate where appropriate.

## Third milestone — test the same expectations on both platforms

- [x] **Define a common scenario catalog per feature.** Scenarios are currently versioned per work item. Record preconditions, initial data, user actions, and expected outcomes. Include relevant success, boundary, failure, permission, offline, and recovery cases. Assign stable scenario identifiers so iOS and Android results can be compared.
- [ ] **Separate shared scenarios from platform execution.** Reuse expected outcomes and fixtures where practical, with platform-specific unit, integration, and UI tests or manual steps. Map each scenario to its implementation on both platforms; do not assume one test script can drive both apps.
- [ ] **Record comparable test runs.** Capture the scenario and specification version, app build or revision, device and OS, environment, test data, outcome, and evidence. Show passed, failed, blocked, and not-run results independently for each platform. Flag incompatible environments or stale evidence before comparing results.
- [x] **Review results against the specification.** Current evidence is recorded as text and references, with explicit operator approval. Compare each platform with the agreed outcomes, then show cross-platform differences. Retain screenshots, logs, and assertions as appropriate. A matching screenshot, completed task, or agent self-report alone must not mark a feature verified.
- [ ] **Add targeted execution and regression support.** Begin with linked test commands and manual evidence. Add supported simulator, emulator, and device runs incrementally. Select regression scenarios from changed features and shared resources; use broader suites for integration or release checks.

Acceptance example: the same reporting scenario and seed data run on iOS and Android. Each platform must produce the expected counts and update behavior. The comparison shows both results and accepted presentation differences, with build and environment evidence sufficient to reproduce failures.

## Deferred — operator-specific focus

My focus is outside the near-term scope. If introduced later, treat it primarily as a stable responsibility associated with an operator's identity or role, rather than a field changed for every task. Resolve operator identity and ownership before adding personal focus storage. Shared feature context and parity tracking must work without this feature.

## Delivery checks

- Preserve existing project objectives, directory links, task history, and execution snapshots when extending the data model.
- Keep feature implementation progress separate from verified parity. Show scope, unknown cases, and accepted exclusions in any aggregate report.
- Add focused checks for feature persistence, shared-resource references, scenario mapping, and stale or incomparable evidence as those capabilities are implemented.
- Distinguish developing mobile apps with Workbench from exposing Workbench itself through its mobile client. Keep Git repositories and ordinary folders supported and document execution-host limitations.
- Review the local workflow before pushing changes to the fork.
