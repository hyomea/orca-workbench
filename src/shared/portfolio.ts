import { z } from 'zod'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Description = z.string().trim().min(1).max(20000)

export const PortfolioAgent = z.enum(['codex', 'claude', 'opencode'])
export const PortfolioTaskStatus = z.enum(['todo', 'running', 'blocked', 'review', 'accepted'])
export const PortfolioProjectInput = z.object({
  name: Name,
  objective: Description,
  repoIds: z.array(Id).max(100)
})
export const PortfolioRoleInput = z.object({
  name: Name,
  responsibility: Description,
  agent: PortfolioAgent
})
export const PortfolioTaskInput = z.object({
  projectId: Id,
  roleId: Id,
  title: Name,
  instructions: Description,
  acceptanceCriteria: Description
})
export const PortfolioAttempt = z.object({
  operationId: Id,
  worktreeId: Id,
  agent: PortfolioAgent,
  prompt: z.string().min(1).max(100000),
  createdAt: z.number(),
  state: z.enum(['pending', 'launched', 'unknown', 'closed']),
  handle: z.string().optional(),
  paneKey: z.string().optional(),
  sessionId: z.string().optional(),
  warning: z.string().optional()
})
export const PortfolioTask = PortfolioTaskInput.extend({
  id: Id,
  status: PortfolioTaskStatus,
  evidence: z.string(),
  attempts: z.array(PortfolioAttempt),
  history: z.array(
    z.object({ id: Id, at: z.number(), status: PortfolioTaskStatus, note: z.string() })
  )
})
export const PortfolioState = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  organization: Name,
  projects: z.array(PortfolioProjectInput.extend({ id: Id })),
  roles: z.array(PortfolioRoleInput.extend({ id: Id })),
  tasks: z.array(PortfolioTask)
})
export type PortfolioState = z.infer<typeof PortfolioState>
export type PortfolioTask = z.infer<typeof PortfolioTask>
export type PortfolioAttempt = z.infer<typeof PortfolioAttempt>

const ProjectDetails = PortfolioProjectInput

export const PortfolioCommand = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('organization.rename'), name: Name }),
  z.object({ kind: z.literal('project.create'), project: PortfolioProjectInput }),
  z.object({
    kind: z.literal('project.update'),
    projectId: Id,
    project: ProjectDetails,
    expected: ProjectDetails
  }),
  z.object({ kind: z.literal('role.create'), role: PortfolioRoleInput }),
  z.object({ kind: z.literal('task.create'), task: PortfolioTaskInput }),
  z.object({ kind: z.literal('task.closeExecution'), taskId: Id, note: Description }),
  z.object({
    kind: z.literal('task.transition'),
    taskId: Id,
    status: PortfolioTaskStatus.exclude(['running']),
    note: Description
  })
])
export type PortfolioCommand = z.infer<typeof PortfolioCommand>

export function emptyPortfolio(): PortfolioState {
  return {
    schemaVersion: 1,
    revision: 0,
    organization: 'My organization',
    projects: [],
    roles: [],
    tasks: []
  }
}

export function portfolioTask(state: PortfolioState, taskId: string): PortfolioTask {
  const task = state.tasks.find((entry) => entry.id === taskId)
  if (!task) {
    throw new Error('Task no longer exists. Refresh the project.')
  }
  return task
}

export function applyPortfolioCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string,
  now: number
): void {
  switch (command.kind) {
    case 'organization.rename':
      state.organization = command.name
      return
    case 'project.create':
      state.projects.push({
        ...command.project,
        repoIds: [...new Set(command.project.repoIds)],
        id
      })
      return
    case 'project.update': {
      const project = state.projects.find((entry) => entry.id === command.projectId)
      if (!project) {
        throw new Error('Project no longer exists. Close this form and refresh.')
      }
      if (
        project.name !== command.expected.name ||
        project.objective !== command.expected.objective ||
        JSON.stringify(project.repoIds) !== JSON.stringify(command.expected.repoIds)
      ) {
        throw new Error(
          'Project details changed. Close and reopen this form to review the latest version.'
        )
      }
      project.name = command.project.name
      project.objective = command.project.objective
      project.repoIds = [...new Set(command.project.repoIds)]
      return
    }
    case 'role.create':
      state.roles.push({ ...command.role, id })
      return
    case 'task.create':
      if (
        !state.projects.some((project) => project.id === command.task.projectId) ||
        !state.roles.some((role) => role.id === command.task.roleId)
      ) {
        throw new Error('Choose an existing project and role.')
      }
      state.tasks.push({
        ...command.task,
        id,
        status: 'todo',
        evidence: '',
        attempts: [],
        history: [{ id: `${id}:0`, at: now, status: 'todo', note: 'Task created' }]
      })
      return
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
      return
    }
    case 'task.transition': {
      const task = portfolioTask(state, command.taskId)
      const attempt = task.attempts.at(-1)
      if (attempt && (attempt.state === 'pending' || attempt.state === 'unknown')) {
        throw new Error('Resolve the uncertain launch before changing this task.')
      }
      if (command.status === 'accepted' && task.status !== 'review') {
        throw new Error('Submit evidence for review before accepting this task.')
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
        note: command.note
      })
    }
  }
}

export function portfolioProgress(tasks: readonly PortfolioTask[]): {
  accepted: number
  total: number
  percent: number
} {
  const accepted = tasks.filter((task) => task.status === 'accepted').length
  return {
    accepted,
    total: tasks.length,
    percent: tasks.length ? Math.round((accepted / tasks.length) * 100) : 0
  }
}

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
