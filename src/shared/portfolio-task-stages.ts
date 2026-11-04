import { z } from 'zod'
import type { PortfolioState, PortfolioTask } from './portfolio'
import { PortfolioWorkPlatform } from './portfolio-features'
import { PortfolioCommit } from './portfolio-review'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Description = z.string().trim().min(1).max(20000)

// One development session builds a track (an outcome on one platform); review and QA follow it.
export const PortfolioTaskStage = z.enum(['development', 'codeReview', 'qa'])
export type PortfolioTaskStage = z.infer<typeof PortfolioTaskStage>
export const PortfolioTaskStep = z.object({
  id: Id,
  title: Name,
  done: z.boolean(),
  commit: PortfolioCommit.optional()
})
export type PortfolioTaskStep = z.infer<typeof PortfolioTaskStep>
const TaskDetails = z.object({
  roleId: Id,
  title: Name,
  instructions: Description,
  acceptanceCriteria: Description,
  platform: PortfolioWorkPlatform.optional(),
  stage: PortfolioTaskStage
})

export const PortfolioTaskStageCommands = [
  z.object({ kind: z.literal('task.update'), taskId: Id, task: TaskDetails }),
  z.object({ kind: z.literal('task.delete'), taskId: Id }),
  z.object({
    kind: z.literal('task.steps'),
    taskId: Id,
    steps: z.array(z.object({ id: Id, title: Name })).max(30)
  }),
  z.object({
    kind: z.literal('task.step'),
    taskId: Id,
    stepId: Id,
    done: z.boolean(),
    commit: PortfolioCommit.optional()
  }),
  // Code review or QA returns findings to the development task of the same track.
  z.object({ kind: z.literal('task.sendBack'), taskId: Id, note: Description })
] as const

export const PORTFOLIO_STAGE_NAMES: Record<PortfolioTaskStage, string> = {
  development: 'development',
  codeReview: 'code review',
  qa: 'QA'
}

export function portfolioTrackTask(
  state: PortfolioState,
  task: Pick<PortfolioTask, 'id' | 'workItemId' | 'platform'>,
  stage: PortfolioTaskStage
): PortfolioTask | undefined {
  if (!task.workItemId) {
    return undefined
  }
  return state.tasks.findLast(
    (entry) =>
      entry.stage === stage &&
      entry.workItemId === task.workItemId &&
      entry.platform === task.platform
  )
}

export function portfolioOpenExecution(task: PortfolioTask): boolean {
  const attempt = task.attempts.at(-1)
  return Boolean(attempt && attempt.state !== 'closed')
}

export function portfolioTaskEvent(
  task: PortfolioTask,
  now: number,
  note: string,
  from?: PortfolioTaskStage
): void {
  task.history.push({
    id: `${task.id}:${task.history.length}`,
    at: now,
    status: task.status,
    note,
    ...(from ? { returnedFrom: from } : {})
  })
}

// Each track has one task per stage, so findings and stage order have one place to go.
export function assertPortfolioTrackSlot(
  state: PortfolioState,
  task: Pick<PortfolioTask, 'id' | 'workItemId' | 'platform' | 'stage'>
): void {
  if (task.stage !== 'development' && !task.workItemId) {
    throw new Error('Code review and QA tasks belong to an outcome.')
  }
  const existing = portfolioTrackTask(state, task, task.stage)
  if (existing && existing.id !== task.id) {
    throw new Error(
      `This outcome already has a ${PORTFOLIO_STAGE_NAMES[task.stage]} task for this platform.`
    )
  }
}

// Reopens the track's development task with findings: a live session gets them relayed,
// a closed one receives them in its next launch prompt. Later stages must run again on the
// next submission, so their finished results are cleared.
export function returnPortfolioFindings(
  state: PortfolioState,
  development: PortfolioTask,
  from: PortfolioTaskStage,
  note: string,
  now: number
): void {
  development.status = portfolioOpenExecution(development) ? 'running' : 'todo'
  development.evidence = ''
  portfolioTaskEvent(
    development,
    now,
    `Returned from ${PORTFOLIO_STAGE_NAMES[from]}: ${note}`,
    from
  )
  for (const stage of ['codeReview', 'qa'] as const) {
    const later = portfolioTrackTask(state, development, stage)
    if (later && (later.status === 'review' || later.status === 'accepted')) {
      const attempt = later.attempts.at(-1)
      if (attempt?.state === 'launched') {
        attempt.state = 'closed'
      }
      later.status = 'todo'
      later.evidence = ''
      portfolioTaskEvent(later, now, 'Development reopened; run again on its next submission')
    }
  }
}

// Findings returned since the development task last submitted, for its next launch prompt.
export function portfolioReturnedFindings(task: PortfolioTask): string[] {
  const lastSubmission = task.history.findLastIndex((entry) => entry.status === 'review')
  return task.history
    .slice(lastSubmission + 1)
    .filter((entry) => entry.returnedFrom)
    .map((entry) => entry.note)
}

export function assertPortfolioStageReady(state: PortfolioState, task: PortfolioTask): void {
  if (task.stage === 'development') {
    return
  }
  const development = portfolioTrackTask(state, task, 'development')
  if (!development || (development.status !== 'review' && development.status !== 'accepted')) {
    throw new Error('Start this after development submits its work.')
  }
  const review = portfolioTrackTask(state, task, 'codeReview')
  if (task.stage === 'qa' && review && review.status !== 'accepted') {
    throw new Error('Start QA after you accept the code review.')
  }
}

export function assertPortfolioDevelopmentAcceptable(
  state: PortfolioState,
  task: PortfolioTask
): void {
  for (const stage of ['codeReview', 'qa'] as const) {
    const later = task.stage === 'development' && portfolioTrackTask(state, task, stage)
    if (later && later.status !== 'accepted') {
      throw new Error(`Accept the ${PORTFOLIO_STAGE_NAMES[stage]} before accepting development.`)
    }
  }
}
