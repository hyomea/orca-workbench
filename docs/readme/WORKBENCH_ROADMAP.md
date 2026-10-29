# Orca Workbench roadmap

## Shared context and personal focus

Planned work: help operators develop across related repositories using a shared understanding of the product, while keeping each operator's focus and each task's deliverable separate. Linking a repository provides context; it does not automatically make that repository a development or migration target.

All items below are pending. The order is a proposed implementation sequence, not a release schedule.

### First milestone — separate the three layers

- [ ] **Define Shared project context, My focus, and Task objective.** Shared context describes the product, business rules, repository relationships, API contracts, and dependencies. My focus describes the operator's responsibilities and current development scope. A task defines a concrete deliverable and acceptance criteria.
- [ ] **Persist an independent focus for each operator and project.** Decide how an operator is identified before implementing storage; an Orca runtime profile must not silently stand in for a person. Changing one operator's focus must leave other operators' focus and the shared project context unchanged. Start with local use; cross-device synchronization and organization accounts are separate work.
- [ ] **Distinguish development targets from reference sources.** Let operators identify the repositories relevant to their focus and use other linked repositories for reference. For example, mobile and its supporting APIs can be development targets while legacy and internal tools explain current behavior. Treat this distinction as context for planning, not a filesystem access-control boundary.
- [ ] **Update AI discovery and refinement.** Draft the observed shared project context separately from the operator's intended focus. Ask for missing scope in Chinese or English; do not infer a platform rewrite or migration objective from migration files alone. Keep evidence, inference, and user-confirmed intent distinguishable.
- [ ] **Update project setup and editing.** Present Shared project context and My focus as separate, editable sections with clear ownership. Keep task objectives in the task workflow. Preserve unconfirmed edits and let the operator review both sections before saving.
- [ ] **Migrate existing projects without losing their objective.** Retain the original objective and ask the operator to classify or refine it when adopting the new fields. Do not silently treat an existing objective as everyone's focus. Preserve task history and previously captured execution instructions.

Acceptance example: two operators use the same project and repository relationships. One focuses on mobile and API development; the other focuses on web workflows. Updating either focus does not change the shared project description or the other operator's scope.

### Second milestone — use the context in agent work

- [ ] **Compose and preview execution context.** Combine the shared project context, the initiating operator's focus, the assigned role, and the task objective and acceptance criteria. Show which repositories are development targets or reference sources, and resolve conflicting instructions before launch.
- [ ] **Snapshot context for each execution.** Record the context and focus used at launch. Later edits affect new executions; retries use the original snapshot so an existing task does not silently change direction.
- [ ] **Maintain shared context across repositories.** Keep source references and review status for business rules, API contracts, and dependencies. Allow targeted refreshes and propose updates for review instead of silently replacing confirmed context with a new scan.

Acceptance example: an agent working on a mobile feature receives the relevant API contract and legacy compatibility constraints, without interpreting reference repositories as authorization for unrelated changes. The operator can inspect the context used for that execution.

## Delivery checks

- Validate operator isolation, legacy-project migration, draft recovery, and execution snapshots with focused regression tests as those features are implemented.
- Keep Git repositories and ordinary folders supported; explicitly document remote-client and mobile-client availability for each milestone.
- Review the local workflow before pushing changes to the fork.
