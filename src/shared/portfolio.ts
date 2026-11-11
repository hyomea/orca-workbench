import { z } from 'zod'
import {
  migrateLegacyWorkItems,
  PortfolioFeature,
  PortfolioFeatureCommands,
  PortfolioWorkItem,
  PortfolioWorkPlatform
} from './portfolio-features'
import { applyPortfolioFeatureCommand } from './portfolio-feature-commands'
import {
  applyPortfolioChecklistCommand,
  PortfolioChecklistCommands
} from './portfolio-checklist-commands'
import {
  applyPortfolioDiscoveryCommand,
  PortfolioDiscoveryCommands
} from './portfolio-outcome-discovery'
import { PortfolioVerification, PortfolioVerificationCommands } from './portfolio-verification'
import { applyPortfolioVerificationCommand } from './portfolio-verification-commands'
import {
  applyPortfolioNoteCommand,
  PortfolioNote,
  PortfolioNoteCommands,
  PortfolioNoteDraft
} from './portfolio-notes'
import { PortfolioCodeReview, PortfolioCommit } from './portfolio-review'
import { applyPortfolioTaskCommand } from './portfolio-task-commands'
import {
  applyPortfolioOutcomeReportCommand,
  PortfolioOutcomeReportCommands
} from './portfolio-outcome-reports'
import {
  applyPortfolioOutcomeCoordinatorCommand,
  PortfolioOutcomeCoordinatorCommands
} from './portfolio-outcome-coordinator'
import {
  applyPortfolioTaskSubmissionCommand,
  PortfolioTaskSubmissionCommands
} from './portfolio-task-submission'
import {
  PortfolioReturnSource,
  PortfolioReviewMode,
  PortfolioTaskStage,
  PortfolioTaskStageCommands,
  PortfolioTaskStep
} from './portfolio-task-stages'
import {
  applyPortfolioRoleCommand,
  PortfolioAgent,
  PortfolioRoleCommands,
  PortfolioRoleInput
} from './portfolio-roles'
export { PortfolioAgent, PortfolioRoleInput } from './portfolio-roles'
export { PortfolioCodeReview, PortfolioCommit } from './portfolio-review'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Description = z.string().trim().min(1).max(20000)

export const PortfolioTaskStatus = z.enum(['todo', 'running', 'blocked', 'review', 'accepted'])
export const PortfolioProjectInput = z.object({
  name: Name,
  objective: Description,
  repoIds: z.array(Id).max(100),
  // Absent means personal.
  reviewMode: PortfolioReviewMode.optional()
})
export const PortfolioTaskInput = z.object({
  projectId: Id,
  roleId: Id,
  title: Name,
  instructions: Description,
  acceptanceCriteria: Description,
  workItemId: Id.optional(),
  platform: PortfolioWorkPlatform.optional(),
  stage: PortfolioTaskStage.default('development')
})
export const PortfolioAttempt = z.object({
  operationId: Id,
  worktreeId: Id,
  agent: PortfolioAgent,
  prompt: z.string().min(1).max(400000),
  createdAt: z.number(),
  state: z.enum(['pending', 'launched', 'unknown', 'closed']),
  handle: z.string().optional(),
  paneKey: z.string().optional(),
  sessionId: z.string().optional(),
  warning: z.string().optional(),
  // For code review and QA: the development commit this session was asked to look at.
  commit: PortfolioCommit.optional()
})
export const PortfolioTask = PortfolioTaskInput.extend({
  id: Id,
  status: PortfolioTaskStatus,
  evidence: z.string(),
  // The development plan; the same session works through it, committing each step.
  steps: z.array(PortfolioTaskStep).default([]),
  attempts: z.array(PortfolioAttempt),
  history: z.array(
    z.object({
      id: Id,
      at: z.number(),
      status: PortfolioTaskStatus,
      note: z.string(),
      codeReview: PortfolioCodeReview.optional(),
      commit: PortfolioCommit.optional(),
      returnedFrom: PortfolioReturnSource.optional(),
      // Development submitted newer commits while its earlier submission was in review.
      resubmitted: z.literal(true).optional()
    })
  )
})
export const PortfolioState = z.object({
  schemaVersion: z.literal(6),
  notes: z.array(PortfolioNote),
  noteDrafts: z.array(PortfolioNoteDraft),
  verification: z.array(PortfolioVerification),
  features: z.array(PortfolioFeature),
  workItems: z.array(PortfolioWorkItem),
  revision: z.number().int().nonnegative(),
  organization: Name,
  // The steward (the user's coordinator agent) by the personal name the user gave it.
  stewardName: Name.optional(),
  projects: z.array(PortfolioProjectInput.extend({ id: Id })),
  roles: z.array(PortfolioRoleInput.extend({ id: Id })),
  tasks: z.array(PortfolioTask)
})
const V4PortfolioState = PortfolioState.omit({ notes: true, noteDrafts: true }).extend({
  schemaVersion: z.literal(4)
})
const LegacyPortfolioState = V4PortfolioState.omit({
  features: true,
  workItems: true,
  verification: true
}).extend({
  schemaVersion: z.literal(1)
})
const NO_NOTES = { schemaVersion: 6, notes: [], noteDrafts: [] } as const
export function parsePortfolioState(input: unknown): PortfolioState {
  const version = z.object({ schemaVersion: z.number() }).parse(input).schemaVersion
  const value =
    version < 6
      ? { ...(input as object), workItems: migrateLegacyWorkItems(input as never) }
      : input
  if (version === 1) {
    const legacy = LegacyPortfolioState.parse(value)
    return PortfolioState.parse({
      ...legacy,
      ...NO_NOTES,
      features: [],
      workItems: [],
      verification: []
    })
  }
  if (version === 2) {
    const legacy = V4PortfolioState.omit({ verification: true })
      .extend({ schemaVersion: z.literal(2) })
      .parse(value)
    return PortfolioState.parse({ ...legacy, ...NO_NOTES, verification: [] })
  }
  if (version === 3 || version === 4) {
    const legacy = V4PortfolioState.extend({ schemaVersion: z.literal(version) }).parse(value)
    return PortfolioState.parse({ ...legacy, ...NO_NOTES })
  }
  return PortfolioState.parse(version === 5 ? { ...(value as object), schemaVersion: 6 } : value)
}
export type PortfolioState = z.infer<typeof PortfolioState>
export type PortfolioTask = z.infer<typeof PortfolioTask>
export type PortfolioAttempt = z.infer<typeof PortfolioAttempt>

// The review mode has its own command, so editing details never resets it by leaving it out.
const ProjectDetails = PortfolioProjectInput.omit({ reviewMode: true })

export const PortfolioCommand = z.discriminatedUnion('kind', [
  ...PortfolioFeatureCommands,
  ...PortfolioChecklistCommands,
  ...PortfolioOutcomeCoordinatorCommands,
  ...PortfolioOutcomeReportCommands,
  ...PortfolioDiscoveryCommands,
  ...PortfolioVerificationCommands,
  ...PortfolioNoteCommands,
  ...PortfolioRoleCommands,
  ...PortfolioTaskStageCommands,
  ...PortfolioTaskSubmissionCommands,
  z.object({ kind: z.literal('organization.rename'), name: Name }),
  z.object({ kind: z.literal('steward.rename'), name: Name.nullable() }),
  z.object({ kind: z.literal('project.create'), project: PortfolioProjectInput }),
  z.object({
    kind: z.literal('project.update'),
    projectId: Id,
    project: ProjectDetails,
    expected: ProjectDetails
  }),
  z.object({ kind: z.literal('project.reviewMode'), projectId: Id, mode: PortfolioReviewMode }),
  z.object({ kind: z.literal('task.create'), task: PortfolioTaskInput }),
  z.object({ kind: z.literal('task.closeExecution'), taskId: Id, note: Description }),
  z.object({
    kind: z.literal('task.transition'),
    taskId: Id,
    status: PortfolioTaskStatus.exclude(['running']),
    note: Description,
    codeReview: PortfolioCodeReview.optional(),
    commit: PortfolioCommit.optional()
  })
])
export type PortfolioCommand = z.infer<typeof PortfolioCommand>

export function emptyPortfolio(): PortfolioState {
  return {
    schemaVersion: 6,
    notes: [],
    noteDrafts: [],
    verification: [],
    features: [],
    workItems: [],
    revision: 0,
    organization: 'My organization',
    projects: [],
    roles: [],
    tasks: []
  }
}

export function applyPortfolioCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string,
  now: number
): void {
  if (
    applyPortfolioVerificationCommand(state, command, id, now) ||
    applyPortfolioFeatureCommand(state, command, id, now) ||
    applyPortfolioChecklistCommand(state, command, id, now) ||
    applyPortfolioOutcomeCoordinatorCommand(state, command, now) ||
    applyPortfolioOutcomeReportCommand(state, command, id, now) ||
    applyPortfolioDiscoveryCommand(state, command, now) ||
    applyPortfolioNoteCommand(state, command, id, now) ||
    applyPortfolioRoleCommand(state, command, id) ||
    applyPortfolioTaskCommand(state, command, id, now) ||
    applyPortfolioTaskSubmissionCommand(state, command, now)
  ) {
    return
  }
  switch (command.kind) {
    case 'organization.rename':
      state.organization = command.name
      return
    case 'steward.rename':
      if (command.name) {
        state.stewardName = command.name
      } else {
        delete state.stewardName
      }
      return
    case 'project.create':
      state.projects.push({
        ...command.project,
        repoIds: [...new Set(command.project.repoIds)],
        id
      })
      return
    case 'project.reviewMode': {
      const project = state.projects.find((entry) => entry.id === command.projectId)
      if (!project) {
        throw new Error('Initiative no longer exists. Refresh the initiative.')
      }
      project.reviewMode = command.mode
      return
    }
    case 'project.update': {
      const project = state.projects.find((entry) => entry.id === command.projectId)
      if (!project) {
        throw new Error('Initiative no longer exists. Close this form and refresh.')
      }
      if (
        project.name !== command.expected.name ||
        project.objective !== command.expected.objective ||
        JSON.stringify(project.repoIds) !== JSON.stringify(command.expected.repoIds)
      ) {
        throw new Error(
          'Initiative details changed. Close and reopen this form to review the latest version.'
        )
      }
      project.name = command.project.name
      project.objective = command.project.objective
      project.repoIds = [...new Set(command.project.repoIds)]
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

export { preparePortfolioAttempt } from './portfolio-attempt'
export { portfolioTask } from './portfolio-task-commands'
