import { z } from 'zod'
import type { PortfolioState, PortfolioTask } from './portfolio'
import { PortfolioWorkPlatform } from './portfolio-features'
import { PortfolioCommit } from './portfolio-review'
import {
  assertPortfolioTrackRole,
  portfolioTrackRole,
  portfolioTrackTicket
} from './portfolio-ticket-roles'
import {
  portfolioStageCommit,
  portfolioStageOutdated,
  portfolioSubmissionIndex,
  portfolioTrackTask
} from './portfolio-track-commits'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Description = z.string().trim().min(1).max(20000)

// One development session builds a track (an outcome on one platform); review and QA follow it.
export const PortfolioTaskStage = z.enum(['development', 'codeReview', 'qa'])
export type PortfolioTaskStage = z.infer<typeof PortfolioTaskStage>
// How an initiative reviews and tests: its agents alone (personal), or its agents together with
// the team's PR review and external QA, which the agents triage (team).
export const PortfolioReviewMode = z.enum(['personal', 'team'])
export type PortfolioReviewMode = z.infer<typeof PortfolioReviewMode>
// Where returned findings came from: code review or QA (sent to development), or the team's PR
// review or external QA (sent to the code review or QA agent to triage).
export const PortfolioReturnSource = z.enum(['codeReview', 'qa', 'pr', 'externalQa'])
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
  // In team mode, new PR comments or external QA feedback reopen code review or QA to triage them.
  z.object({ kind: z.literal('task.requestTriage'), taskId: Id, note: Description }),
  // Code review or QA looks at development's next submission in the session that sent it back.
  z.object({ kind: z.literal('task.runAgain'), taskId: Id }),
  // The user lets the development session push its branch and open, or update, a draft PR.
  z.object({ kind: z.literal('task.confirmPush'), taskId: Id })
] as const

export const PORTFOLIO_STAGE_NAMES: Record<PortfolioTaskStage, string> = {
  development: 'development',
  codeReview: 'code review',
  qa: 'QA'
}

const RETURN_SOURCE_NAMES: Record<PortfolioReturnSource, string> = {
  codeReview: 'code review',
  qa: 'QA',
  pr: 'PR review',
  externalQa: 'external QA'
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
  assertPortfolioTrackRole(portfolioTrackRole(state, task), task.stage)
  const existing = portfolioTrackTask(state, task, task.stage)
  if (existing && existing.id !== task.id) {
    throw new Error(
      `This outcome already has a ${PORTFOLIO_STAGE_NAMES[task.stage]} task for this platform.`
    )
  }
}

// Reopens a task with findings: a live session gets them relayed, a closed one receives them in
// its next launch prompt.
export function reopenPortfolioTask(
  task: PortfolioTask,
  from: PortfolioReturnSource,
  note: string,
  now: number
): void {
  task.status = portfolioOpenExecution(task) ? 'running' : 'todo'
  task.evidence = ''
  portfolioTaskEvent(task, now, `Returned from ${RETURN_SOURCE_NAMES[from]}: ${note}`, from)
}

// Reopens the track's development task with findings. Later stages must run again on the next
// submission, so their finished results are cleared; an open session stays open to run it.
export function returnPortfolioFindings(
  state: PortfolioState,
  development: PortfolioTask,
  from: Exclude<PortfolioTaskStage, 'development'>,
  note: string,
  now: number
): void {
  reopenPortfolioTask(development, from, note, now)
  for (const stage of ['codeReview', 'qa'] as const) {
    const later = portfolioTrackTask(state, development, stage)
    if (later && (later.status === 'review' || later.status === 'accepted')) {
      later.status = 'todo'
      later.evidence = ''
      portfolioTaskEvent(later, now, 'Development reopened; run again on its next submission')
    }
  }
}

// Findings returned since the task last submitted, for its next launch prompt.
export function portfolioReturnedFindings(task: PortfolioTask): string[] {
  return task.history
    .slice(portfolioSubmissionIndex(task) + 1)
    .filter((entry) => entry.returnedFrom)
    .map((entry) => entry.note)
}

export function assertPortfolioStageReady(state: PortfolioState, task: PortfolioTask): void {
  if (task.stage === 'development') {
    return
  }
  if (portfolioTrackRole(state, task) === 'reviewer') {
    assertPortfolioReviewerStageReady(state, task)
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

// A reviewer's code review looks at the teammate's PR as checked out in its workspace, so it
// waits for nothing here; QA still follows the accepted review.
function assertPortfolioReviewerStageReady(state: PortfolioState, task: PortfolioTask): void {
  if (!portfolioTrackTicket(state, task)?.pr) {
    throw new Error('Add the teammate’s PR link to this platform’s ticket first.')
  }
  const review = portfolioTrackTask(state, task, 'codeReview')
  if (task.stage === 'qa' && review && review.status !== 'accepted') {
    throw new Error('Start QA after you accept the code review.')
  }
}

// Development is accepted after its later stages, and every acceptance covers the commit
// development last submitted, not one it has since replaced.
export function assertPortfolioTaskAcceptable(state: PortfolioState, task: PortfolioTask): void {
  const outdated = (later: PortfolioTask) => {
    const stale = portfolioStageOutdated(state, later)
    if (stale) {
      throw new Error(
        `The ${PORTFOLIO_STAGE_NAMES[later.stage]} looked at ${stale.reviewed.slice(0, 8)}, but development has since submitted ${stale.current.slice(0, 8)}. Have it look at the new commits first.`
      )
    }
  }
  if (task.stage !== 'development') {
    outdated(task)
    return
  }
  for (const stage of ['codeReview', 'qa'] as const) {
    const later = portfolioTrackTask(state, task, stage)
    if (later && later.status !== 'accepted') {
      throw new Error(`Accept the ${PORTFOLIO_STAGE_NAMES[stage]} before accepting development.`)
    }
    if (later) {
      outdated(later)
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
    assertPortfolioTaskAcceptable(state, task)
    return undefined
  } catch (failure) {
    return failure instanceof Error ? failure.message : String(failure)
  }
}
