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
// Where findings returned to development came from: a later stage, or review on the PR.
export const PortfolioReturnSource = z.enum(['codeReview', 'qa', 'pr'])
export type PortfolioReturnSource = z.infer<typeof PortfolioReturnSource>
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
  z.object({ kind: z.literal('task.sendBack'), taskId: Id, note: Description }),
  // PR review feedback reopens accepted development; code review and QA run again only if asked.
  z.object({
    kind: z.literal('task.returnPrFeedback'),
    taskId: Id,
    note: Description,
    rerunChecks: z.boolean()
  })
] as const

export const PORTFOLIO_STAGE_NAMES: Record<PortfolioTaskStage, string> = {
  development: 'development',
  codeReview: 'code review',
  qa: 'QA'
}

const RETURN_SOURCE_NAMES: Record<PortfolioReturnSource, string> = {
  codeReview: 'code review',
  qa: 'QA',
  pr: 'PR review'
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
  from?: PortfolioReturnSource
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
// a closed one receives them in its next launch prompt. Later stages run again on the next
// submission unless the user keeps their results (small fixes from PR review).
export function returnPortfolioFindings(
  state: PortfolioState,
  development: PortfolioTask,
  from: PortfolioReturnSource,
  note: string,
  now: number,
  rerunChecks = true
): void {
  development.status = portfolioOpenExecution(development) ? 'running' : 'todo'
  development.evidence = ''
  portfolioTaskEvent(development, now, `Returned from ${RETURN_SOURCE_NAMES[from]}: ${note}`, from)
  for (const stage of rerunChecks ? (['codeReview', 'qa'] as const) : []) {
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

// A submission is the entry that moved the task into review; later entries can keep that status
// (such as an execution closed during review) without being a new submission.
function latestSubmissionIndex(task: PortfolioTask): number {
  return task.history.findLastIndex(
    (entry, index) => entry.status === 'review' && task.history[index - 1]?.status !== 'review'
  )
}

export function portfolioSubmittedCommit(task: PortfolioTask): string | undefined {
  return task.history[latestSubmissionIndex(task)]?.commit
}

// The version a code review or QA task looks at: what development submitted. QA can also take
// the commit an accepted code review recorded, since the reviewer adds no commits of its own and
// development may have been submitted before submissions recorded one.
export function portfolioStageCommit(
  state: PortfolioState,
  task: PortfolioTask
): string | undefined {
  const development = portfolioTrackTask(state, task, 'development')
  const submitted = development && portfolioSubmittedCommit(development)
  if (submitted || task.stage !== 'qa') {
    return submitted
  }
  const review = portfolioTrackTask(state, task, 'codeReview')
  return review?.status === 'accepted' ? portfolioSubmittedCommit(review) : undefined
}

// Findings returned since the development task last submitted, for its next launch prompt.
export function portfolioReturnedFindings(task: PortfolioTask): string[] {
  return task.history
    .slice(latestSubmissionIndex(task) + 1)
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
  // Review and QA look at a fixed version, so there must be a commit to look at.
  if (!portfolioStageCommit(state, task)) {
    throw new Error(
      'Development has no submitted commit. Ask the development agent to commit and submit.'
    )
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

// Why a task cannot start yet, for the page to show before the user tries.
export function portfolioStageBlocker(
  state: PortfolioState,
  task: PortfolioTask
): string | undefined {
  try {
    assertPortfolioStageReady(state, task)
    return undefined
  } catch (failure) {
    return failure instanceof Error ? failure.message : String(failure)
  }
}

export function portfolioAcceptBlocker(
  state: PortfolioState,
  task: PortfolioTask
): string | undefined {
  try {
    assertPortfolioDevelopmentAcceptable(state, task)
    return undefined
  } catch (failure) {
    return failure instanceof Error ? failure.message : String(failure)
  }
}
