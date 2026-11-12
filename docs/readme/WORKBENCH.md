# Workbench projects

Orca Workbench adds a **Projects** page to the desktop sidebar. Business projects group work across repositories and folder workspaces. Organization roles retain a responsibility and an agent choice (Codex, Claude, or OpenCode); each task records its instructions, acceptance criteria, execution attempts, and review history.

See the [Workbench roadmap](WORKBENCH_ROADMAP.md) for remaining iOS/Android discovery, automation, and shared-resource work.
The [feature parity v1 design](FEATURE_PARITY_V1.md) describes the broader target workflow based on Jira acceptance criteria and design references. The manual verification loop below is available now.

## Workflow

Create and switch Workbenches from the desktop sidebar. To remove a named Workbench, open its sidebar actions and choose **Remove workbench**, then confirm. To reset the built-in Workbench, choose **Clear workbench**; its empty entry remains. Both actions delete the selected Workbench's saved initiatives, tasks, design attachments, and coordinator files. Other Workbenches, the shared personal notes setting, agent sessions, and workspaces remain.

Use a Workbench's sidebar actions to export it as an `.orca-workbench.zip` file (up to 256 MiB). The file contains its saved state and referenced design attachments, including task prompts and history. Use the Workbench sidebar menu to import it on another computer; import creates a separate Workbench. Imported initiatives retain their history and attachments, while repository links, workspace/session handles, and active coordinator assignments are cleared. Tasks that were running become To do. Relink repositories before starting tasks. Agent sessions, repositories, local coordinator files, generated note-file copies, account credentials, and the shared personal notes folder are not included.

Choose Claude or Codex from the dropdown beside **Steward chat** on the Workbench page. The choice applies to the next Steward session. Close an existing coordinator session before opening the newly selected agent; Orca will not send a Steward prompt to a session using a different agent. The Steward's standing notes are preserved across changes. Open the active Workbench's **Steward chat** from its sidebar entry or the Workbench page. Its internal folder is kept out of the Projects list.

1. Open **Projects** and choose **New project**. Import a directory or select repositories and folder groups already in Orca. Nested repositories can be imported separately. Imports register workspaces immediately, even if project setup is later canceled.
2. Choose **Import and analyze** to import the selected directories and generate a draft in one step, or **Draft objective with AI** for sources already in Orca. Review the proposed understanding and objective, and add corrections in Chinese or English. Choose the response language and refine the draft as needed. **Confirm and save** creates the project. **Start with an idea** works without directories; **Write manually** skips AI.
3. Create organization roles, then assign a role when creating a task.
4. Open the task, choose a local workspace, and select **Start agent**. The existing Orca launcher starts a background session with the project objective, role responsibility, task instructions, and acceptance criteria. Inspect the session through **Open workspace**.
5. Add verification results and links under **Evidence or review note**, then **Submit for review**.
6. Review the evidence, add a review note, and **Accept result**. Only accepted tasks count toward project and organization progress.

Status observations show their last observed time. Missing observations are not interpreted as agent completion. Task status changes do not terminate agent processes. Before starting another execution for the same task, stop the previous agent in its workspace and record that confirmation using **I have stopped this execution**.

Use **Edit project** to update a project's name, objective, and directory links. New executions use the updated objective. Existing executions and retries retain their saved instructions. Tasks and review history are preserved. If another window changes the project details while the form is open, close and reopen the form to review the latest version before saving.

## Features and work items

Open a project to see **Features** by default, or switch to **Tasks** for the project task board. Create a named capability with shared context. Open the feature and add an **Initial delivery**, **Bug**, **Improvement**, or **Needs triage** work item. Each work item keeps its own description, acceptance criteria, design notes, source reference, status, and history. Import shared context from Jira and design links in the work-item editor, or enter it manually. Saved work items also support screenshot attachments.

A work item records the feature specification version in effect when it is created. Initial deliveries and improvements are proposals until explicitly published. Bugs and triage items cannot publish a specification. The feature retains earlier specification versions; concurrent proposals cannot overwrite a newer version silently. Publication stores the work item's complete description, AC, and references, so an improvement must include the full intended specification rather than only a change summary. New improvement drafts start with the current specification. The editor keeps its starting version and rejects creation if another change has published a newer version; preserve your notes and discard/recreate the draft to reconcile the new baseline.

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
6. The latest failed, blocked, or rejected result for a scenario in the current plan can **Create fix task** for a selected role. It carries the platform, reproduction, expected behavior, and evidence, and returns the work item to Active. Open that task to launch its agent. Creating or reopening tasks and starting new attempts make earlier test evidence outdated for the entire work item; rerun both platforms after the change. Other findings in the same plan can still create their own fixes, but stale evidence cannot be approved. Moving or detaching a task after results have been recorded requires a new test-plan version first, so removing the task cannot revive older passing evidence.
7. After linked tasks are accepted, executions closed, and all planned platform checks reviewed and passed, move the work item to In review and accept it. Initial delivery and improvement specifications require a separate explicit publication confirmation. A bug closes without replacing the shared specification.

**Revise test plan** creates a new version and requires fresh coverage confirmation and results. Old plans, results, review decisions, fix links, and prompts remain in history. A newer failed or unreviewed result supersedes an older passing result. Evidence cannot be reviewed after its plan or linked work changes; a result form opened before work changes is rejected on save. Existing v1/v2 approvals do not imply verified parity.

Task history tracks changes made through Workbench; external source edits, changing URLs, incompatible environments, and stale build identifiers are not detected automatically. Operators must compare evidence with the confirmed AC, design notes, shared data, and actual build. Both platforms are required for each scenario in this increment; platform exclusions are not yet modeled. Accepted work is frozen until explicitly reopened; published work requires a follow-up.

Test-plan and result drafts survive closing or switching tabs in the same window. Draft recovery after app shutdown is not guaranteed. Saved plans and results persist across restarts.

## Workflow guidance and design screenshots

Projects uses one page scrollbar, including navigation, project context, and feature content. The project objective and linked sources are available under **Project context**. Switching between Features and Tasks retains the selected feature. An empty feature offers a single **New work item** action.

Each work item shows a **Next step** based on its requirements, tasks, test plan, evidence, and publication state. The action opens the relevant editor or tab; it does not advance statuses or launch agents automatically. Task definitions and execution remain manual.

**New role** offers Product Analyst, Product Designer, iOS Engineer, Android Engineer, and Parity QA templates. **Apply template** replaces the form's name and responsibility. Customize these fields and choose the agent before saving. Templates describe expected inputs, outputs, and review boundaries; they do not establish an automatic handoff pipeline.

In a saved work item's **Shared context**, use **Attach screenshot** for PNG, JPEG, or WebP images, up to 5 MiB each and 12 images per item. Copies persist in the profile's `workbench/design-attachments` directory. Images can be attached or removed only while the item is Planned, all linked tasks are accepted and executions closed, and no test plan exists. Attach images before assigning implementation tasks. Preview images with **View image**. Removal unlinks the current item; it does not delete historical copies.

Plans and published specifications snapshot attachment metadata. New work items inherit the current specification's images. Agent launch prompts snapshot local paths and content hashes for proposed and baseline designs. Agents need image tools and permission to read those paths; the launcher does not guarantee visual inspection. Remote hosts and the dedicated mobile client are outside this increment. Test-result evidence still uses text and references; screenshot uploads here represent design context, not executed-test evidence.

Attachment writes precede metadata commits. A stale or interrupted upload can leave an unreferenced content-addressed file; automatic garbage collection is not implemented. Back up the entire `workbench` directory to preserve images alongside records. Preview verifies saved image bytes against their hash.

## Work-item context sources

The work-item editor offers **Add shared context**. Choose Codex or Claude and a response language, then paste a Jira ticket or design link and select **Read and fill draft**. Jira uses the existing local connection and an explicit account selection when several accounts match. The agent receives the retrieved title and description and proposes a name, problem statement, acceptance criteria, design notes, and references. Custom Jira fields, comments, and image bytes are not included; long source text is bounded and marked as shortened.

Empty fields and unchanged AI-generated fields are filled automatically. Existing user edits and saved-item text remain intact, with optional per-field suggestions. New improvements provide the current baseline to the agent for a complete proposed specification; review it for unchanged requirements. The agent asks at most three clarification questions. Supply answers or corrections and use **Refine draft with AI** to revise the proposal. Review and save explicitly; importing never creates tasks or updates the external source. Sources, results, questions, and edits survive closing the editor in the current window. Stop cancels analysis and late output is discarded.

Design URLs retain Figma node identifiers and are sent to the selected agent for read-only inspection. This flow runs in a temporary directory with the provider's configured account; repository-scoped MCP configurations are not loaded. Codex uses its existing read-only generation sandbox and available user-level tools. Claude retains plan mode, exposes WebFetch, and permits specific read tools from a user-level MCP server named `figma` (`get_design_context`, `get_screenshot`, `get_metadata`, `get_variable_defs`). Source access still depends on provider tools, authentication, server naming, and link sharing permissions. This is not a dedicated Figma or Claude Design connector. Hooks remain disabled for Claude background generation.

The **Source access report** records the agent's read/unavailable assessment and content excerpts or access errors for every supplied URL. When no source is readable, the existing draft is returned unchanged. The report is an agent assessment, not an independently audited fetch log. Inaccessible links stay available as references; screenshots can be attached to the saved work item as an alternative. Link-based drafting has automated contract and UI coverage; authenticated external access must be verified with the user's configured account.

Imported ticket text is a reviewed snapshot, not a live synchronization with Jira. Saving a work item does not update or comment on the source ticket. Reimport explicitly when source requirements change, respecting frozen work-item and specification rules.

### Jira browser login for local development

The local desktop's Jira connection dialog supports Atlassian OAuth authorization in the system browser. Register an **OAuth 2.0 integration** in the [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/), add Jira API classic scopes `read:jira-work` and `read:jira-user`, and configure the exact callback `http://127.0.0.1:17653/jira/oauth/callback`. Enter the application's Client ID and secret in **Application setup** in Workbench. The authorization request includes `offline_access` for token renewal. Enable sharing under **Distribution** if a different Atlassian account will authorize the app; that account must have access to the chosen Jira site.

Select **Sign in with Atlassian**, grant access in the browser, then select an authorized Jira site in Workbench. The callback listens only on IPv4 loopback, validates a random state, and expires after five minutes. Closing the dialog cancels an unfinished sign-in. This connection supports issue reads, searches, and context import; Jira issue mutations require a connection with write permissions. Remote hosts and self-hosted Jira retain the API-token connection form.

Application credentials and rotating refresh tokens use the existing local Jira credential store under `~/.orca`, shared across local profiles. OS encryption is used when available; the dialog reports the fallback to owner-restricted plaintext files. Disconnect removes the local site credentials, but does not revoke the application's authorization in the Atlassian account. Application setup is intended for a locally configured development fork. A distributed desktop build must keep the application secret in a protected backend rather than bundle it or ask each end user to register an application.

## AI project discovery

Discovery samples documentation, manifests, and entry-point code from selected native local directories. It respects ignore files, skips hidden files, dependency/build directories, and common credential paths, and bounds listing depth, excerpt size, and total context. The review shows which files supplied excerpts. This is a sample, not a complete repository audit. Review selected directories before sending proprietary material; these filters are not a secrets detector.

Codex or Claude runs with the selected provider's configured Orca account and its default text-generation model, in a temporary working directory. Claude tools are disabled; Codex uses its existing read-only generation sandbox. Selected excerpts are included in the prompt. The draft separates observed implementation from proposed direction and may ask up to three clarifying questions. Closing the editor keeps its draft, analysis, edits, and directory selections in the current window. Reopening project setup restores them; editing drafts are separated by project and Orca profile. Confirming a successful save or explicitly confirming **Discard draft** clears the draft. Imported directories remain registered. Draft recovery is not guaranteed after closing the application. Dismissal is blocked while import, analysis, or saving is active. Stop cancels the request, and a late response cannot replace the current draft. An unsuccessful analysis leaves manual editing available.

Directory analysis supports native local paths, including non-Git folders. Remote and WSL sources are not supported in this first version. Idea-only projects can receive directory links later through **Edit project**; launching a task requires a linked workspace.

## Project notes

Open a project and choose **Notes** to keep durable project knowledge in Markdown. **Offer to agents** is on by default. When a task starts, its prompt lists each offered note's id, title, and the path of a read-only copy in the profile's `workbench/note-files` directory. Copies are named by content hash, so a retried launch keeps pointing at the text it was launched with; editing a note affects only later launches.

Agents cannot edit notes directly. A task prompt explains how to submit a proposal:

```bash
orca workbench note propose --project <id> --task <id> [--note <id>] --title <title> --body-file <file> --reason <why>
```

Proposals appear under **Agent proposals**. Review and edit the text, then accept or dismiss it. An update proposal shows a warning when the note changed after it was proposed. Deleting a note keeps its pending proposals as suggestions for a new note. A project holds at most 50 pending proposals.

**Export** writes one Markdown file per note into a chosen directory. Each file begins with front matter containing `id`, `title`, `updated`, and `agentContext`. Exporting again updates files that carry the same note id. Exporting never replaces other files: a name collision gets a numbered suffix. Notes deleted in Orca are not removed from an earlier export.

**Import** accepts `.md`, `.markdown`, and `.txt` files. Files without front matter take their title from the first heading or the file name. A file matches an existing note by exported id, then by title. New notes are selected by default. Replacing an existing note requires selecting it after comparing the current and imported text. Every replacement checks that the note has not changed since the preview.

## Persistence and recovery

Schema v5 stores features, work items, optional task/platform links, versioned test plans, platform evidence, design attachment metadata, project notes, and pending note proposals. Reading v1 through v4 upgrades it in memory without rewriting the file. The first successful mutation preserves an exact `portfolio.json.v1.bak` through `portfolio.json.v4.bak` matching the source version before writing v5. Older builds reject v5 rather than silently dropping notes, attachments, or verification records. Backups are never overwritten with different contents; conflicting backups block migration.

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

`src/main/portfolio/portfolio-store.test.ts` covers concurrent writers, corrupt and newer-version files, ambiguous launch replay, repository membership, execution replacement, and evidence-before-acceptance. Component fixtures cover the populated board, empty state, and a narrow container in both themes. Feature and verification tests cover migration backups, scoped task context, immutable publication, a failed-test → agent-fix → retest → review → acceptance loop, stale evidence, and discovery-to-definition. A component integration test runs the manual plan/result/review/publication flow through the UI. Fixtures also cover parity and result forms in light/dark and narrow layouts. Attachment tests cover v3 migration, upload validation, persistence, immutable version inheritance, preview integrity, and prompt replay. UI tests cover template customization, next-step navigation, upload retry, preview, and removal. Fixture rendering does not validate a live Electron agent session.
