# Workbench projects

Orca Workbench adds a **Projects** page to the desktop sidebar. Business projects group work across repositories and folder workspaces. Organization roles retain a responsibility and an agent choice (Codex, Claude, or OpenCode); each task records its instructions, acceptance criteria, execution attempts, and review history.

See the [Workbench roadmap](WORKBENCH_ROADMAP.md) for planned shared project context, operator-specific focus, and task context improvements.

## Workflow

1. Open **Projects** and choose **New project**. Import a directory or select repositories and folder groups already in Orca. Nested repositories can be imported separately. Imports register workspaces immediately, even if project setup is later canceled.
2. Choose **Import and analyze** to import the selected directories and generate a draft in one step, or **Draft objective with AI** for sources already in Orca. Review the proposed understanding and objective, and add corrections in Chinese or English. Choose the response language and refine the draft as needed. **Confirm and save** creates the project. **Start with an idea** works without directories; **Write manually** skips AI.
3. Create organization roles, then assign a role when creating a task.
4. Open the task, choose a local workspace, and select **Start agent**. The existing Orca launcher starts a background session with the project objective, role responsibility, task instructions, and acceptance criteria. Inspect the session through **Open workspace**.
5. Add verification results and links under **Evidence or review note**, then **Submit for review**.
6. Review the evidence, add a review note, and **Accept result**. Only accepted tasks count toward project and organization progress.

Status observations show their last observed time. Missing observations are not interpreted as agent completion. Task status changes do not terminate agent processes. Before starting another execution for the same task, stop the previous agent in its workspace and record that confirmation using **I have stopped this execution**.

Use **Edit project** to update a project's name, objective, and directory links. New executions use the updated objective. Existing executions and retries retain their saved instructions. Tasks and review history are preserved. If another window changes the project details while the form is open, close and reopen the form to review the latest version before saving.

## AI project discovery

Discovery samples documentation, manifests, and entry-point code from selected native local directories. It respects ignore files, skips hidden files, dependency/build directories, and common credential paths, and bounds listing depth, excerpt size, and total context. The review shows which files supplied excerpts. This is a sample, not a complete repository audit. Review selected directories before sending proprietary material; these filters are not a secrets detector.

Codex or Claude runs with the selected provider's configured Orca account and its default text-generation model, in a temporary working directory. Claude tools are disabled; Codex uses its existing read-only generation sandbox. Selected excerpts are included in the prompt. The draft separates observed implementation from proposed direction and may ask up to three clarifying questions. Closing the editor keeps its draft, analysis, edits, and directory selections in the current window. Reopening project setup restores them; editing drafts are separated by project and Orca profile. Confirming a successful save or explicitly confirming **Discard draft** clears the draft. Imported directories remain registered. Draft recovery is not guaranteed after closing the application. Dismissal is blocked while import, analysis, or saving is active. Stop cancels the request, and a late response cannot replace the current draft. An unsuccessful analysis leaves manual editing available.

Directory analysis supports native local paths, including non-Git folders. Remote and WSL sources are not supported in this first version. Idea-only projects can receive directory links later through **Edit project**; launching a task requires a linked workspace.

## Persistence and recovery

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

`src/main/portfolio/portfolio-store.test.ts` covers concurrent writers, corrupt and newer-version files, ambiguous launch replay, repository membership, execution replacement, and evidence-before-acceptance. Component fixtures cover the populated board, empty state, and a narrow container in both themes. Fixture rendering does not validate a live Electron agent session.
