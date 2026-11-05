import {
  portfolioTask,
  type PortfolioState,
  type PortfolioAttempt,
  type PortfolioTask
} from './portfolio'
import { portfolioFeaturePrompt } from './portfolio-feature-commands'
import {
  assertPortfolioStageReady,
  portfolioReturnedFindings,
  portfolioStageCommit,
  portfolioTrackTask
} from './portfolio-task-stages'

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
  const attempt: PortfolioAttempt = {
    operationId,
    worktreeId,
    agent: role.agent,
    createdAt: now,
    state: 'pending',
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
      ...portfolioReturnedFindings(task).map((note) => `Address these findings first:\n${note}`)
    ]
  }
  const development = portfolioTrackTask(state, task, 'development')
  const commit = portfolioStageCommit(state, task)
  return [
    task.stage === 'codeReview'
      ? 'Stage: code review. Review the development work on this branch; do not edit code.'
      : 'Stage: QA. Test the development work on this branch; do not edit product code.',
    `Development task: ${development?.title ?? 'unknown'}${commit ? ` (submitted at commit ${commit})` : ''}`,
    ...portfolioTeamReviewPrompt(state, task),
    ...portfolioReturnedFindings(task).map((note) => `Triage this new feedback first:\n${note}`)
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
