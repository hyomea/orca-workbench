import {
  portfolioTask,
  type PortfolioState,
  type PortfolioAttempt,
  type PortfolioTask
} from './portfolio'
import { portfolioFeaturePrompt } from './portfolio-feature-prompt'
import { assertPortfolioStageReady, portfolioReturnedFindings } from './portfolio-task-stages'
import { portfolioStageCommit, portfolioTrackTask } from './portfolio-track-commits'
import { portfolioTrackRole, portfolioTrackTicket } from './portfolio-ticket-roles'

export function preparePortfolioAttempt(
  state: PortfolioState,
  taskId: string,
  worktreeId: string,
  repoId: string,
  operationId: string,
  now: number,
  designContext = ''
): PortfolioAttempt {
  const task = portfolioTask(state, taskId)
  const previous = task.attempts.at(-1)
  if (previous && (previous.state === 'pending' || previous.state === 'unknown')) {
    if (previous.worktreeId !== worktreeId) {
      throw new Error('Retry the original workspace to resolve this launch.')
    }
    previous.state = 'pending'
    return previous
  }
  if (task.status !== 'todo') {
    throw new Error('Only a planned task can start a new execution.')
  }
  if (previous && previous.state !== 'closed') {
    throw new Error('Stop and close the previous execution before starting another.')
  }
  const project = state.projects.find((entry) => entry.id === task.projectId)
  const role = state.roles.find((entry) => entry.id === task.roleId)
  if (!project || !role || !project.repoIds.includes(repoId)) {
    throw new Error('Choose a workspace from a repository linked to this initiative.')
  }
  assertPortfolioStageReady(state, task)
  // Code review and QA read the development branch, so only two development sessions conflict.
  // Accepted work is finished; a task in review may still resume in this workspace.
  if (
    task.stage === 'development' &&
    state.tasks.some(
      (entry) =>
        entry.id !== taskId &&
        entry.stage === 'development' &&
        entry.status !== 'accepted' &&
        entry.attempts.at(-1)?.state !== 'closed' &&
        entry.attempts.at(-1)?.worktreeId === worktreeId
    )
  ) {
    throw new Error(
      'Another development task is running in this workspace. Choose a separate workspace.'
    )
  }
  // Code review and QA record the development commit they look at, to notice a newer one.
  const commit =
    task.stage !== 'development' && portfolioTrackRole(state, task) !== 'reviewer'
      ? portfolioStageCommit(state, task)
      : undefined
  const attempt: PortfolioAttempt = {
    operationId,
    worktreeId,
    agent: role.agent,
    createdAt: now,
    state: 'pending',
    ...(commit ? { commit } : {}),
    prompt: [
      `Initiative: ${project.name}`,
      `Objective: ${project.objective}`,
      ...portfolioFeaturePrompt(state, task),
      ...(designContext ? [designContext] : []),
      `Role: ${role.name}`,
      ...(role.agentName ? [`Your name: ${role.agentName}`] : []),
      `Responsibility: ${role.responsibility}`,
      `Task: ${task.title}`,
      ...portfolioStagePrompt(state, task),
      task.instructions,
      `Acceptance criteria:\n${task.acceptanceCriteria}`,
      // The submission steps live in the orca-cli skill so they can change without relaunching.
      `This is Workbench task ${task.id}. When the user asks you to submit it, follow "Submitting a task" in the orca-cli skill's Workbench reference.`
    ].join('\n\n')
  }
  task.attempts.push(attempt)
  task.status = 'running'
  task.history.push({
    id: `${task.id}:${task.history.length}`,
    at: now,
    status: 'running',
    note: `Execution requested (${role.agent})`
  })
  return attempt
}

function portfolioStagePrompt(state: PortfolioState, task: PortfolioTask): string[] {
  if (task.stage === 'development') {
    return [
      ...(task.steps.length
        ? [
            `Development steps (commit after each one and mark it done):\n${task.steps
              .map((step) => `- [${step.done ? 'x' : ' '}] ${step.id}: ${step.title}`)
              .join('\n')}`
          ]
        : []),
      'Do not push or open a PR on your own. When the user confirms it from Workbench, push this branch and open (or update) a draft PR; never mark it ready, request reviewers, or merge. If the user asks you in this session to push, push, then record it with `orca workbench task pushed`.',
      'If the user asks for more changes after you submit, commit them and run `task submit` again: it resubmits, so code review and QA can look at the new commits.',
      'Rebase this branch only when the user or the outcome coordinator asks; when the base has moved, report it with `outcome report` instead. After a rebase, run the tests and resubmit.',
      ...portfolioReturnedFindings(task).map((note) => `Address these findings first:\n${note}`)
    ]
  }
  if (portfolioTrackRole(state, task) === 'reviewer') {
    return [
      ...portfolioReviewerPrompt(task, portfolioTrackTicket(state, task)?.pr ?? ''),
      ...portfolioReturnedFindings(task).map((note) => `Review this new round first:\n${note}`)
    ]
  }
  const development = portfolioTrackTask(state, task, 'development')
  const commit = portfolioStageCommit(state, task)
  return [
    task.stage === 'codeReview'
      ? 'Stage: code review. Review the development work on this branch; do not edit code.'
      : 'Stage: QA. Test the development work on this branch; do not edit product code.',
    'Do not push, or open, comment on, or mark ready a PR; the development agent opens it when the user confirms.',
    `Development task: ${development?.title ?? 'unknown'}${commit ? ` (submitted at commit ${commit})` : ''}`,
    ...portfolioTeamReviewPrompt(state, task),
    ...portfolioReturnedFindings(task).map((note) => `Triage this new feedback first:\n${note}`)
  ]
}

// The user reviews and tests a teammate's PR; findings go to the user to post, not to development.
function portfolioReviewerPrompt(task: PortfolioTask, pr: string): string[] {
  const boundary =
    'The teammate builds this platform; the user is their reviewer. Do not edit product code, push, or comment on, approve, or resolve anything on the PR; the user posts what they choose.'
  return task.stage === 'codeReview'
    ? [
        `Stage: code review of a teammate's pull request, ${pr}, checked out in this workspace. Review its changes against its base branch, and read the PR's existing comments with \`gh\` (read only) so you do not repeat them.`,
        boundary,
        'Draft each finding as a PR comment the user can post: file and line, what and why, and whether it blocks approval. Submit at the commit you reviewed.'
      ]
    : [
        `Stage: QA of a teammate's pull request, ${pr}, after the user's code review. Focus on integration: run the change end to end against the real services where you can, and check the flows it touches, how it works with neighbouring features and the other platforms, and regressions.`,
        boundary,
        'Run the existing integration tests that cover it. Propose missing integration tests in your report instead of leaving them in the workspace, since submitting needs it clean.'
      ]
}

// In team mode the agent also triages the team's feedback; the user decides what goes back.
function portfolioTeamReviewPrompt(state: PortfolioState, task: PortfolioTask): string[] {
  if (state.projects.find((project) => project.id === task.projectId)?.reviewMode !== 'team') {
    return []
  }
  const verdicts = 'must fix, not needed (with the reason), or needs discussion'
  if (task.stage === 'codeReview') {
    return [
      `Team review: the branch's pull request also gets review from the team. Read its comments with \`gh\` (read only; do not post, resolve, or push), and give each one a verdict: ${verdicts}, with a drafted reply the user can post.`
    ]
  }
  const link = state.workItems.find((item) => item.id === task.workItemId)?.qaFeedbackUrl
  return [
    link
      ? `External QA: the QA team records feedback at ${link}. Read it (read only; do not edit it), and give each item a verdict: ${verdicts}.`
      : 'External QA: this outcome has no QA feedback link yet. Ask the user for it before triaging external QA feedback.'
  ]
}
