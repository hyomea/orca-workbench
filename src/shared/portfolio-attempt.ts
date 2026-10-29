import { portfolioTask, type PortfolioState, type PortfolioAttempt } from './portfolio'
import { portfolioFeaturePrompt } from './portfolio-feature-commands'

export function preparePortfolioAttempt(
  state: PortfolioState,
  taskId: string,
  worktreeId: string,
  repoId: string,
  operationId: string,
  now: number
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
    throw new Error('Choose a workspace from a repository linked to this project.')
  }
  if (
    state.tasks.some(
      (entry) =>
        entry.id !== taskId &&
        entry.attempts.at(-1)?.state !== 'closed' &&
        entry.attempts.at(-1)?.worktreeId === worktreeId
    )
  ) {
    throw new Error(
      'Another project task is running in this workspace. Choose a separate workspace.'
    )
  }
  const attempt: PortfolioAttempt = {
    operationId,
    worktreeId,
    agent: role.agent,
    createdAt: now,
    state: 'pending',
    prompt: [
      `Project: ${project.name}`,
      `Objective: ${project.objective}`,
      ...portfolioFeaturePrompt(state, task),
      `Role: ${role.name}`,
      `Responsibility: ${role.responsibility}`,
      `Task: ${task.title}`,
      task.instructions,
      `Acceptance criteria:\n${task.acceptanceCriteria}`,
      'Report changes, verification evidence, and blockers. Completion requires user review.'
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
