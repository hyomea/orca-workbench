import type { PortfolioCommand, PortfolioState, PortfolioTask } from './portfolio'
import { workItemForTask } from './portfolio-feature-commands'
import {
  assertPortfolioDevelopmentAcceptable,
  assertPortfolioStageReady,
  assertPortfolioTrackSlot,
  portfolioOpenExecution,
  portfolioStageCommit,
  portfolioTaskEvent,
  portfolioTrackTask,
  reopenPortfolioTask,
  returnPortfolioFindings
} from './portfolio-task-stages'
import { portfolioTrackRole } from './portfolio-ticket-roles'

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
      assertPortfolioTrackSlot(state, { ...command.task, id })
      state.tasks.push({
        ...command.task,
        id,
        status: 'todo',
        evidence: '',
        steps: [],
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
      // The user's own look at the code is recorded for development; review and QA are the check.
      if (command.status === 'accepted' && task.stage === 'development' && !command.codeReview) {
        throw new Error('Record whether you reviewed the code or skipped it before accepting.')
      }
      if (command.status === 'accepted') {
        assertPortfolioDevelopmentAcceptable(state, task)
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
        ...(command.status === 'accepted' && command.codeReview
          ? { codeReview: command.codeReview }
          : {}),
        ...(command.status === 'review' && command.commit ? { commit: command.commit } : {})
      })
      return true
    }
    case 'task.update': {
      const task = portfolioTask(state, command.taskId)
      if (task.status !== 'todo' || portfolioOpenExecution(task)) {
        throw new Error('Only a task that is not running can be edited.')
      }
      if (!state.roles.some((role) => role.id === command.task.roleId)) {
        throw new Error('Choose an existing role.')
      }
      const { platform: _platform, ...rest } = task
      const next = { ...rest, ...command.task }
      assertPortfolioTrackSlot(state, next)
      state.tasks[state.tasks.indexOf(task)] = next
      portfolioTaskEvent(next, now, 'Task details changed')
      return true
    }
    case 'task.delete': {
      const task = portfolioTask(state, command.taskId)
      if (task.status !== 'todo' || portfolioOpenExecution(task)) {
        throw new Error('Only a task that is not running can be deleted.')
      }
      if (
        state.verification.some((entry) =>
          entry.results.some((result) => result.fixTaskId === task.id)
        )
      ) {
        throw new Error('A test result links to this task; keep it for that record.')
      }
      state.tasks.splice(state.tasks.indexOf(task), 1)
      return true
    }
    case 'task.steps': {
      const task = developmentTask(state, command.taskId)
      if (new Set(command.steps.map((step) => step.id)).size !== command.steps.length) {
        throw new Error('Each step needs a unique ID.')
      }
      // Re-planning keeps the progress of steps that stay in the plan.
      task.steps = command.steps.map(
        (step) =>
          task.steps.find((entry) => entry.id === step.id && entry.title === step.title) ?? {
            ...step,
            done: false
          }
      )
      return true
    }
    case 'task.step': {
      const task = developmentTask(state, command.taskId)
      const index = task.steps.findIndex((entry) => entry.id === command.stepId)
      if (index === -1) {
        throw new Error('This task has no step with that ID.')
      }
      const { commit: _commit, ...step } = task.steps[index]
      task.steps[index] = {
        ...step,
        done: command.done,
        ...(command.done && command.commit ? { commit: command.commit } : {})
      }
      return true
    }
    case 'task.sendBack': {
      const task = portfolioTask(state, command.taskId)
      if (task.stage === 'development' || task.status !== 'review') {
        throw new Error('Send back findings from a submitted code review or QA task.')
      }
      if (portfolioTrackRole(state, task) === 'reviewer') {
        throw new Error('A teammate builds this platform; post your findings on their PR.')
      }
      const development = portfolioTrackTask(state, task, 'development')
      if (!development) {
        throw new Error('This outcome has no development task for this platform.')
      }
      const attempt = task.attempts.at(-1)
      if (attempt && (attempt.state === 'pending' || attempt.state === 'unknown')) {
        throw new Error('Resolve the uncertain launch before changing this task.')
      }
      // This round is over. The session stays open, so the next submission is checked by the same
      // agent, which remembers what it found (task.runAgain).
      task.status = 'todo'
      task.evidence = ''
      portfolioTaskEvent(task, now, `Sent back to development: ${command.note}`)
      returnPortfolioFindings(state, development, task.stage, command.note, now)
      return true
    }
    case 'task.requestTriage': {
      const task = portfolioTask(state, command.taskId)
      const project = state.projects.find((entry) => entry.id === task.projectId)
      if (project?.reviewMode !== 'team' && portfolioTrackRole(state, task) !== 'reviewer') {
        throw new Error('Only a team initiative has PR review or external QA feedback to triage.')
      }
      if (
        task.stage === 'development' ||
        (task.status !== 'review' && task.status !== 'accepted')
      ) {
        throw new Error('Ask a submitted code review or QA task to triage new feedback.')
      }
      const attempt = task.attempts.at(-1)
      if (attempt && (attempt.state === 'pending' || attempt.state === 'unknown')) {
        throw new Error('Resolve the uncertain launch before changing this task.')
      }
      reopenPortfolioTask(task, task.stage === 'qa' ? 'externalQa' : 'pr', command.note, now)
      return true
    }
    case 'task.runAgain': {
      const task = portfolioTask(state, command.taskId)
      if (task.stage === 'development' || task.status !== 'todo') {
        throw new Error('Run a code review or QA task again after development submits again.')
      }
      if (task.attempts.at(-1)?.state !== 'launched') {
        throw new Error('This task has no open session; start a new one.')
      }
      assertPortfolioStageReady(state, task)
      task.status = 'running'
      task.evidence = ''
      portfolioTaskEvent(
        task,
        now,
        `Running again in the same session on ${portfolioStageCommit(state, task)}`
      )
      return true
    }
    default:
      return false
  }
}

function developmentTask(state: PortfolioState, taskId: string): PortfolioTask {
  const task = portfolioTask(state, taskId)
  if (task.stage !== 'development') {
    throw new Error('Only development tasks have steps.')
  }
  if (task.status === 'accepted') {
    throw new Error('This task is accepted; its steps are final.')
  }
  return task
}
