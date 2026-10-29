# Workbench projects

Orca Workbench adds a **Projects** page to the desktop sidebar. Business projects group work across repositories and folder workspaces. Organization roles retain a responsibility and an agent choice (Codex, Claude, or OpenCode); each task records its instructions, acceptance criteria, execution attempts, and review history.

## Workflow

1. Add repositories or folders through Orca's existing sidebar.
2. Open **Projects**, create a business project, and select its repositories or folder groups.
3. Create organization roles, then assign a role when creating a task.
4. Open the task, choose a local workspace, and select **Start agent**. The existing Orca launcher starts a background session with the project objective, role responsibility, task instructions, and acceptance criteria. Inspect the session through **Open workspace**.
5. Add verification results and links under **Evidence or review note**, then **Submit for review**.
6. Review the evidence, add a review note, and **Accept result**. Only accepted tasks count toward project and organization progress.

Status observations show their last observed time. Missing observations are not interpreted as agent completion. Task status changes do not terminate agent processes. Before starting another execution for the same task, stop the previous agent in its workspace and record that confirmation using **I have stopped this execution**.

## Persistence and recovery

Data lives in `workbench/portfolio.json` under the current Orca profile's user-data directory. Writes use a file lock, atomic replacement, and a revision precondition. A stale window must refresh before retrying a change. Unreadable data and unsupported schema versions fail without replacing the existing file.

Each launch intent is saved before dispatch. **Retry original launch** reuses its operation ID and prompt through `agent.launchReplay`. An uncertain response does not authorize a new launch. If replay remains unresolved, inspect and stop any existing execution before explicitly closing it. That confirmation records an operator decision; it does not cancel a process or establish that the runtime has stopped one.

## Current scope

- One organization per profile, with multiple business projects and persistent roles.
- Local Git worktrees and folder workspaces; remote hosts and the dedicated mobile application do not yet expose this workflow.
- Manual assignment, evidence submission, and review. No automatic scheduling, role hierarchy, milestones, notifications, or background progress reports.
- Review is a workflow state, not a separate authorization boundary. Existing workspace RPC access can mutate these records; this is not a multi-user approval or organization-permission system.
- Project, role, and task definitions are created once in this initial version; editing, archiving, and deletion are not yet exposed.
- Existing Orca account, model, and launch settings apply. Installed agent CLIs and their accounts must already work in Orca.

## Validation

`src/main/portfolio/portfolio-store.test.ts` covers concurrent writers, corrupt and newer-version files, ambiguous launch replay, repository membership, execution replacement, and evidence-before-acceptance. Component fixtures cover the populated board, empty state, and a narrow container in both themes. Fixture rendering does not validate a live Electron agent session.
