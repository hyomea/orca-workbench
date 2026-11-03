import type { PortfolioCommand, PortfolioState, PortfolioTask } from './portfolio'
import { workItemForTask } from './portfolio-feature-commands'

export function portfolioTask(state: PortfolioState, taskId: string): PortfolioTask {
  const task = state.tasks.find((entry) => entry.id === taskId)
  if (!task) {
    throw new Error('Task no longer exists. Refresh the initiative.')
  }
  return task
}

export function applyPortfolioTaskCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string,
  now: number
): boolean {
  switch (command.kind) {
    case 'task.create':
      if (
        !state.projects.some((project) => project.id === command.task.projectId) ||
        !state.roles.some((role) => role.id === command.task.roleId)
      ) {
        throw new Error('Choose an existing initiative and role.')
      }
      if (command.task.workItemId) {
        workItemForTask(state, command.task.projectId, command.task.workItemId)
      }
      state.tasks.push({
        ...command.task,
        id,
        status: 'todo',
        evidence: '',
        attempts: [],
        history: [{ id: `${id}:0`, at: now, status: 'todo', note: 'Task created' }]
      })
      return true
    case 'task.closeExecution': {
      const task = portfolioTask(state, command.taskId)
      const attempt = task.attempts.at(-1)
      if (!attempt) {
        throw new Error('This task has no execution to close.')
      }
      if (attempt.state === 'pending') {
        throw new Error('Wait for the launch to settle, or retry it after reconnecting.')
      }
      if (task.status === 'running' || attempt.state === 'unknown') {
        task.status = 'todo'
        task.evidence = ''
      }
      attempt.state = 'closed'
      task.history.push({
        id: `${task.id}:${task.history.length}`,
        at: now,
        status: task.status,
        note: `User confirmed execution stopped: ${command.note}`
      })
      return true
    }
    case 'task.transition': {
      const task = portfolioTask(state, command.taskId)
      if (task.workItemId) {
        workItemForTask(state, task.projectId, task.workItemId)
      }
      const attempt = task.attempts.at(-1)
      if (attempt && (attempt.state === 'pending' || attempt.state === 'unknown')) {
        throw new Error('Resolve the uncertain launch before changing this task.')
      }
      if (command.status === 'accepted' && task.status !== 'review') {
        throw new Error('Submit evidence for review before accepting this task.')
      }
      if (command.status === 'accepted' && !command.codeReview) {
        throw new Error('Record whether you reviewed the code or skipped it before accepting.')
      }
      if (command.status === 'review') {
        task.evidence = command.note
      }
      if (task.status === command.status) {
        throw new Error('Task already has this status.')
      }
      task.status = command.status
      if (command.status === 'todo') {
        task.evidence = ''
      }
      task.history.push({
        id: `${task.id}:${task.history.length}`,
        at: now,
        status: command.status,
        note: command.note,
        ...(command.status === 'accepted' ? { codeReview: command.codeReview } : {}),
        ...(command.status === 'review' && command.commit ? { commit: command.commit } : {})
      })
      return true
    }
    default:
      return false
  }
}
