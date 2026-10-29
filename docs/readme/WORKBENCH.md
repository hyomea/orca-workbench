# Workbench projects

Orca Workbench adds a **Projects** page to the desktop sidebar. Business projects group work across repositories and folder workspaces. Organization roles retain a responsibility and an agent choice (Codex, Claude, or OpenCode); each task records its instructions, acceptance criteria, execution attempts, and review history.

See the [Workbench roadmap](WORKBENCH_ROADMAP.md) for remaining iOS/Android discovery, automation, and shared-resource work.
The [feature parity v1 design](FEATURE_PARITY_V1.md) describes the broader target workflow based on Jira acceptance criteria and design references. The manual verification loop below is available now.

## Workflow

1. Open **Projects** and choose **New project**. Import a directory or select repositories and folder groups already in Orca. Nested repositories can be imported separately. Imports register workspaces immediately, even if project setup is later canceled.
2. Choose **Import and analyze** to import the selected directories and generate a draft in one step, or **Draft objective with AI** for sources already in Orca. Review the proposed understanding and objective, and add corrections in Chinese or English. Choose the response language and refine the draft as needed. **Confirm and save** creates the project. **Start with an idea** works without directories; **Write manually** skips AI.
3. Create organization roles, then assign a role when creating a task.
4. Open the task, choose a local workspace, and select **Start agent**. The existing Orca launcher starts a background session with the project objective, role responsibility, task instructions, and acceptance criteria. Inspect the session through **Open workspace**.
5. Add verification results and links under **Evidence or review note**, then **Submit for review**.
6. Review the evidence, add a review note, and **Accept result**. Only accepted tasks count toward project and organization progress.

Status observations show their last observed time. Missing observations are not interpreted as agent completion. Task status changes do not terminate agent processes. Before starting another execution for the same task, stop the previous agent in its workspace and record that confirmation using **I have stopped this execution**.

Use **Edit project** to update a project's name, objective, and directory links. New executions use the updated objective. Existing executions and retries retain their saved instructions. Tasks and review history are preserved. If another window changes the project details while the form is open, close and reopen the form to review the latest version before saving.

## Features and work items

Open a project and choose **Features** to create a named capability with shared context. Open the feature and add an **Initial delivery**, **Bug**, **Improvement**, or **Needs triage** work item. Each work item keeps its own description, acceptance criteria, design notes, source reference, status, and history. References are text only in this increment; paste Jira AC and describe or link design material. Jira import, image attachment, and automated parity analysis remain planned.

A work item records the feature specification version in effect when it is created. Initial deliveries and improvements are proposals until explicitly published. Bugs and triage items cannot publish a specification. The feature retains earlier specification versions; concurrent proposals cannot overwrite a newer version silently. Publication stores the work item's complete description, AC, and references, so an improvement must include the full intended specification rather than only a change summary.

Create tasks from a work item or attach an existing planned task from the same project. Existing project-level tasks remain available. Agent launches include feature context, the work item's original specification, its proposed change, the current shared test plan, target platform, and task instructions. Choose iOS, Android, or Shared / discovery / QA when assigning a task. Retries retain the original prompt. A work item can be edited or classified while it is planned, all linked tasks are accepted with executions closed, and no test plan exists. This permits discovery tasks to produce reviewed AC before implementation. Once a test plan freezes the scope, create follow-up work for requirement changes.

Use a review note to move work through Planned, Active, Blocked, In review, and Accepted. Delivery acceptance requires review, accepted linked tasks, closed linked executions, and reviewed passing evidence for every planned scenario on both platforms. Needs-triage acceptance records investigation findings only; it does not establish parity. Previously accepted records migrated from older schemas remain historical approvals and cannot publish a new specification until they have current verification. Accepting a work item does not automatically publish its specification. Choose **Publish as current specification** on an accepted initial delivery or improvement, review the confirmation, and publish explicitly. Published work is immutable; use a new work item for further changes.

Feature and work-item form drafts survive closing their editor in the same window. Successful saves or explicit draft discard clear them. Recovery after closing the application is not guaranteed in this increment.

## Shared scenarios, parity, and rework

A work item exposes **Shared context**, **Tasks**, **Parity & tests**, and **Review**. For an idea, begin with discovery tasks, review their outputs, close their executions, return the work item to Planned if needed, and edit its AC and classification. Existing AC and design notes can be entered directly.

1. In **Parity & tests**, create a test plan. Each scenario identifies the AC it covers, shared preconditions and test data, steps, expected behavior, and intentional native-platform differences. Up to 20 scenarios are supported per plan.
2. Review the AC and design coverage and choose **Confirm AC and scenario coverage** with a review note. Coverage is an operator judgment, not an automated completeness check.
3. Assign implementation and QA tasks to roles through **Tasks**. Start agents using the existing task workspace launcher. New attempts snapshot feature context, the original specification, current test plan, target platform, and task instructions. Uncertain retries retain their original prompt.
4. Run tests using the platform's existing tools. Stop and close linked agent executions before recording results. Select an iOS or Android scenario cell and **Record test result** with Pass, Fail, or Blocked, a build/commit, device/OS/environment, and actual behavior plus evidence references. Recording does not execute tests or upload artifacts.
5. Inspect each result and approve or reject its evidence with a review note. A recorded pass is insufficient: each scenario needs the latest result to pass and have approved evidence on both platforms. Review notes are operator records, not authenticated independent reviewer identities.
6. A failed, blocked, or rejected current result can **Create fix task** for a selected role. It carries the platform, reproduction, expected behavior, and evidence, and returns the work item to Active. Open that task to launch its agent. Creating or reopening tasks and starting new attempts make earlier test evidence outdated for the entire work item; rerun both platforms after the change.
7. After linked tasks are accepted, executions closed, and all planned platform checks reviewed and passed, move the work item to In review and accept it. Initial delivery and improvement specifications require a separate explicit publication confirmation. A bug closes without replacing the shared specification.

**Revise test plan** creates a new version and requires fresh coverage confirmation and results. Old plans, results, review decisions, fix links, and prompts remain in history. A newer failed or unreviewed result supersedes an older passing result. Evidence cannot be reviewed after its plan or linked work changes; a result form opened before work changes is rejected on save. Existing v1/v2 approvals do not imply verified parity.

Task history tracks changes made through Workbench; external source edits, changing URLs, incompatible environments, and stale build identifiers are not detected automatically. Operators must compare evidence with the confirmed AC, design notes, shared data, and actual build. Both platforms are required for each scenario in this increment; platform exclusions are not yet modeled. Accepted work is frozen until explicitly reopened; published work requires a follow-up.

Test-plan and result drafts survive closing or switching tabs in the same window. Draft recovery after app shutdown is not guaranteed. Saved plans and results persist across restarts.

## AI project discovery

Discovery samples documentation, manifests, and entry-point code from selected native local directories. It respects ignore files, skips hidden files, dependency/build directories, and common credential paths, and bounds listing depth, excerpt size, and total context. The review shows which files supplied excerpts. This is a sample, not a complete repository audit. Review selected directories before sending proprietary material; these filters are not a secrets detector.

Codex or Claude runs with the selected provider's configured Orca account and its default text-generation model, in a temporary working directory. Claude tools are disabled; Codex uses its existing read-only generation sandbox. Selected excerpts are included in the prompt. The draft separates observed implementation from proposed direction and may ask up to three clarifying questions. Closing the editor keeps its draft, analysis, edits, and directory selections in the current window. Reopening project setup restores them; editing drafts are separated by project and Orca profile. Confirming a successful save or explicitly confirming **Discard draft** clears the draft. Imported directories remain registered. Draft recovery is not guaranteed after closing the application. Dismissal is blocked while import, analysis, or saving is active. Stop cancels the request, and a late response cannot replace the current draft. An unsuccessful analysis leaves manual editing available.

Directory analysis supports native local paths, including non-Git folders. Remote and WSL sources are not supported in this first version. Idea-only projects can receive directory links later through **Edit project**; launching a task requires a linked workspace.

## Persistence and recovery

Schema v3 stores features, work items, optional task/platform links, versioned test plans, and platform evidence. Reading v1 or v2 upgrades it in memory without rewriting the file. The first successful mutation preserves an exact `portfolio.json.v1.bak` or `portfolio.json.v2.bak` matching the source version before writing v3. Older builds reject v3 rather than silently dropping verification records. Backups are never overwritten with different contents; conflicting backups block migration.

Data lives in `workbench/portfolio.json` under the current Orca profile's user-data directory. Writes use a file lock, atomic replacement, and a revision precondition. A stale window must refresh before retrying a change. Unreadable data and unsupported schema versions fail without replacing the existing file.

Each launch intent is saved before dispatch. **Retry original launch** reuses its operation ID and prompt through `agent.launchReplay`. An uncertain response does not authorize a new launch. If replay remains unresolved, inspect and stop any existing execution before explicitly closing it. That confirmation records an operator decision; it does not cancel a process or establish that the runtime has stopped one.

## Current scope

- One organization per profile, with multiple business projects and persistent roles.
- Local Git worktrees and folder workspaces; remote hosts and the dedicated mobile application do not yet expose this workflow.
- Manual assignment, evidence submission, and review. No automatic scheduling, role hierarchy, milestones, notifications, or background progress reports.
- Review is a workflow state, not a separate authorization boundary. Existing workspace RPC access can mutate these records; this is not a multi-user approval or organization-permission system.
- Project names, objectives, and directory links can be edited. Role and task definitions cannot yet be edited; archiving and deletion are not exposed.
- Existing Orca account, model, and launch settings apply. Installed agent CLIs and their accounts must already work in Orca.

## Validation

`src/main/portfolio/portfolio-store.test.ts` covers concurrent writers, corrupt and newer-version files, ambiguous launch replay, repository membership, execution replacement, and evidence-before-acceptance. Component fixtures cover the populated board, empty state, and a narrow container in both themes. Feature and verification tests cover migration backups, scoped task context, immutable publication, a failed-test → agent-fix → retest → review → acceptance loop, stale evidence, and discovery-to-definition. A component integration test runs the manual plan/result/review/publication flow through the UI. Fixtures also cover parity and result forms in light/dark and narrow layouts. Fixture rendering does not validate a live Electron agent session.
