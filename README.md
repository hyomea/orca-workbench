# Orca Workbench

A desktop workspace for developing related projects with shared context, agent roles, and reviewed test evidence.

Workbench focuses on **iOS and Android feature parity**: define the behavior both platforms should deliver, identify what can be shared, and verify each implementation against the same expectations. API, web, legacy, and internal-tool repositories can provide supporting context within the same project.

Built on [Orca by Stably](https://github.com/stablyai/orca), Workbench extends its agent sessions, terminals, repository workspaces, and Git worktrees with a project and feature workflow.

**Development preview.** Workbench additions currently live on `feature/projects-ui`; `dev` is the integration branch. Run this checkout locally to use them. Upstream Orca downloads do not include these additions.

[User guide](docs/readme/WORKBENCH.md) · [Feature parity design](docs/readme/FEATURE_PARITY_V1.md) · [Roadmap](docs/readme/WORKBENCH_ROADMAP.md)

## What you can do today

| Capability                   | Current behavior                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects across repositories | Group local Git repositories and ordinary folders around a shared objective.                                                                                                            |
| AI-assisted project setup    | Analyze a bounded sample of existing files, draft an objective, and refine it before saving. Start from an idea or write manually as well.                                              |
| Shared feature context       | Keep acceptance criteria, design references, screenshots, and versioned specifications together. Track initial delivery, bugs, improvements, and investigations as separate work items. |
| Link-to-draft import         | Read a Jira ticket or accessible design link and propose work-item fields. Review suggestions, preserve existing edits, and refine with additional context.                             |
| Agent roles and tasks        | Define responsibilities, assign iOS, Android, or shared tasks, and launch an agent in a linked workspace with a snapshot of its context.                                                |
| Parity and test evidence     | Define common scenarios, record separate iOS and Android results, review evidence, and create fix tasks for failed results.                                                             |
| Reviewed specifications      | Accept completed work and explicitly publish an initial delivery or improvement as the feature's current specification. Retain previous versions.                                       |

The interface provides feature and work-item lists, expandable project context, and a single page scroll area. Saved project records persist locally; unfinished form drafts can be reopened within the same window.

## How the work fits together

| Level             | Purpose                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Project**       | Shared objective and repositories, such as a mobile product and its supporting APIs.                           |
| **Feature**       | A lasting capability, such as event reporting or ticket scanning, with its published specification.            |
| **Work item**     | A specific initial delivery, bug, improvement, or investigation, with its own requirements and history.        |
| **Task**          | Work assigned to an agent role for a platform or shared responsibility, with execution attempts and review.    |
| **Test scenario** | Common preconditions, actions, and expected behavior, with independent results and evidence for each platform. |

Parity is agreement on user-visible behavior and business rules. Native presentation and interactions can differ intentionally. Two implementations matching each other does not prove that either meets the requirements.

## A typical workflow

1. **Create a project.** Import relevant directories, let AI propose an understanding and objective, then review and save.
2. **Add a feature and work item.** Start from an idea or bring existing Jira acceptance criteria and design material. Use investigation tasks to resolve missing requirements before implementation.
3. **Review the shared context.** Confirm the problem, acceptance criteria, design references, and screenshots. Import proposes a draft; saving remains explicit.
4. **Define scenarios and delegate.** Confirm a common test plan and assign implementation or verification tasks to roles. Templates include Product Analyst, Product Designer, iOS Engineer, Android Engineer, and Parity QA.
5. **Run and review.** Use the existing platform test tools, record results with build and environment details, and review evidence for both platforms. Link failures to fix tasks and retest after changes.
6. **Accept and publish when ready.** Delivery acceptance requires accepted tasks, closed linked executions, and reviewed passing evidence for every planned scenario on both platforms. Publishing the feature specification is a separate confirmation.

Publishing a specification updates local Workbench records. It does **not** push Git commits, release an app, or update a Jira ticket.

See the [user guide](docs/readme/WORKBENCH.md) for scope-freezing rules, investigation workflows, draft recovery, and evidence invalidation.

## Jira and design sources

**Jira Cloud:** the local desktop supports browser authorization through an Atlassian OAuth application. Configure the application's Client ID, secret, and callback once, sign in in your browser, then confirm the authorized site in Workbench. This connection reads issues and imports context. API-token connections remain available for remote hosts, self-hosted Jira, and appropriately authorized write operations. Follow the [OAuth setup instructions](docs/readme/WORKBENCH.md#jira-browser-login-for-local-development).

**Design links:** Figma and other design URLs are passed to the selected agent for inspection using its available tools and account access. The import shows a source-access report and clarification questions. This is not a dedicated Figma or Claude Design connector; inaccessible links remain references. Attach screenshots to a saved work item when direct access is unavailable.

**Agent accounts:** AI project discovery and work-item drafting support configured Codex or Claude accounts. Task roles can use Codex, Claude, or OpenCode. Install and authenticate the chosen agent before launching work.

## Run locally

Prerequisites:

- Node.js 24 and the pnpm version pinned in [package.json](package.json).
- The Bun version in [config/.bun-version](config/.bun-version) for the default test runner.
- Native build tools for your OS; see [local setup](.github/CONTRIBUTING.md#local-setup).
- Access to the private repository.

```bash
git clone --branch feature/projects-ui https://github.com/hyomea/orca-workbench-private.git
cd orca-workbench-private
pnpm install
pnpm -C mobile install --frozen-lockfile
pnpm dev --worktree-profile
```

`--worktree-profile` uses a separate application profile for this checkout. On startup, the runner prints the profile directory and renderer URL. Existing profiles are reused when restarting the same checkout.

Renderer changes normally update during development without an app restart. Main-process and backend changes require a restart; save open forms first. See [development profiles](.github/CONTRIBUTING.md#dev-profiles-and-parallel-instances) for profile seeding and parallel instances.

## Current boundaries

- The Workbench workflow currently targets **local desktop use** with Git worktrees and folder workspaces. It is not yet exposed through remote hosts or Orca's mobile companion.
- Task assignment, handoffs, test execution, evidence review, and acceptance remain operator-driven. Role templates do not create an automatic agent pipeline.
- Jira imports are snapshots. They do not continuously synchronize tickets, and currently omit comments, custom fields, and attachment image bytes.
- Design screenshots are shared requirements context. Test-result evidence currently uses text and references; attaching a design image does not establish a test result.
- Both iOS and Android results are required for each delivery scenario. Platform exclusions and automated parity assessment remain planned.
- Saved data persists under the active profile's `workbench` directory. Back up that entire directory to include attachments. Unsaved draft recovery after closing the app is not guaranteed.
- AI analysis samples files and proposes interpretations. Review its findings and source access; it is not a complete code audit or proof of parity.

See the [roadmap](docs/readme/WORKBENCH_ROADMAP.md) for planned discovery, shared-resource tracking, and test automation.

## Development and validation

Keep changes on feature branches, integrate reviewed work into `dev`, and promote to `main` explicitly. Ongoing work is backed up to the private repository; publishing to the public fork is a separate decision.

During iteration, run the tests relevant to the edit. For example:

```bash
pnpm test src/renderer/src/components/portfolio/PortfolioFeatures.test.tsx --maxWorkers=2
pnpm tc:web
pnpm fixtures:shot 'portfolio/PortfolioFeatures:workItemList*' --theme both
```

Include persistence, execution, and RPC tests when those contracts change. Before integrating a feature into `dev`, run:

```bash
pnpm check:changed --base=dev --maxWorkers=2
```

[Workbench documentation](docs/readme/WORKBENCH.md) describes validation coverage. [CONTRIBUTING.md](.github/CONTRIBUTING.md) covers the inherited build system, native dependencies, and test tools.

## Upstream and license

Orca Workbench is independently developed from [stablyai/orca](https://github.com/stablyai/orca). Credit for the underlying application and its existing capabilities belongs to the Orca contributors. Documentation in this repository outside the Workbench guides may describe upstream Orca behavior.

The project retains the [MIT License](LICENSE) and upstream copyright notice.
