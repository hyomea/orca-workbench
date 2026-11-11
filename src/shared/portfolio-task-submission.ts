import { z } from 'zod'
import type { PortfolioState } from './portfolio'
import { PortfolioCommit } from './portfolio-review'
import { portfolioOpenExecution, portfolioTaskEvent } from './portfolio-task-stages'
import { portfolioSubmittedCommit } from './portfolio-track-commits'

const Id = z.string().trim().min(1).max(4096)
const Evidence = z.string().trim().min(1).max(20000)

export const PortfolioTaskSubmissionCommands = [
  // Development committed more after submitting (the user asked in its session): the newer
  // commits replace the submission under review. Code review and QA then show they are behind.
  z.object({
    kind: z.literal('task.resubmit'),
    taskId: Id,
    note: Evidence,
    commit: PortfolioCommit
  }),
  // The development session pushed because the user asked in the session rather than from
  // Workbench; recorded like a confirmed push so the history shows every push.
  z.object({ kind: z.literal('task.recordPush'), taskId: Id, commit: PortfolioCommit })
] as const
type SubmissionCommand = z.infer<(typeof PortfolioTaskSubmissionCommands)[number]>

export function applyPortfolioTaskSubmissionCommand(
  state: PortfolioState,
  command: { kind: string },
  now: number
): boolean {
  if (!PortfolioTaskSubmissionCommands.some((schema) => schema.shape.kind.value === command.kind)) {
    return false
  }
  const typed = command as SubmissionCommand
  const task = state.tasks.find((entry) => entry.id === typed.taskId)
  if (!task) {
    throw new Error('Task no longer exists.')
  }
  if (task.stage !== 'development' || !portfolioOpenExecution(task)) {
    throw new Error('Only an open development session can do this.')
  }
  if (typed.kind === 'task.recordPush') {
    portfolioTaskEvent(
      task,
      now,
      `Pushed the branch at ${typed.commit} (the user asked in the session)`
    )
    return true
  }
  if (task.status !== 'review') {
    throw new Error(`Task ${task.id} is ${task.status}; submit it the usual way.`)
  }
  if (portfolioSubmittedCommit(task) === typed.commit) {
    throw new Error('This commit is already submitted. Commit the new work, then submit again.')
  }
  task.evidence = typed.note
  task.history.push({
    id: `${task.id}:${task.history.length}`,
    at: now,
    status: 'review',
    note: typed.note,
    commit: typed.commit,
    resubmitted: true
  })
  return true
}
