import { z } from 'zod'
import type { PortfolioState } from './portfolio'

const Id = z.string().trim().min(1).max(4096)
const MAX_REPORTS = 50

// An agent's open question or decision request about its outcome. It waits in the outcome's inbox
// for the outcome's coordinator (or the workbench coordinator) to bring it to the user, instead of
// staying in the agent's own chat.
export const PortfolioOutcomeReportInput = z.object({
  body: z.string().trim().min(1).max(4000),
  // The task whose agent asked.
  taskId: Id.optional()
})
export const PortfolioOutcomeReport = PortfolioOutcomeReportInput.extend({
  id: Id,
  at: z.number()
})
export type PortfolioOutcomeReport = z.infer<typeof PortfolioOutcomeReport>

export const PortfolioOutcomeReportCommands = [
  z.object({
    kind: z.literal('workItem.report'),
    workItemId: Id,
    report: PortfolioOutcomeReportInput
  }),
  // Answered or no longer relevant; the note says what was decided.
  z.object({
    kind: z.literal('workItem.resolveReport'),
    workItemId: Id,
    reportId: Id,
    note: z.string().trim().max(4000).optional()
  })
] as const
type ReportCommand = z.infer<(typeof PortfolioOutcomeReportCommands)[number]>

// Note proposals that belong to the outcome: proposed for it, or by one of its tasks.
export function portfolioOutcomeNoteDrafts(
  state: PortfolioState,
  workItemId: string
): PortfolioState['noteDrafts'] {
  return state.noteDrafts.filter(
    (draft) =>
      draft.workItemId === workItemId ||
      (!draft.workItemId &&
        state.tasks.some((task) => task.id === draft.taskId && task.workItemId === workItemId))
  )
}

// What waits for the user on an outcome: checklist proposals, agents' questions, and notes.
export function portfolioOutcomeInboxCount(state: PortfolioState, workItemId: string): number {
  const item = state.workItems.find((entry) => entry.id === workItemId)
  return (
    (item?.proposals?.length ?? 0) +
    (item?.reports?.length ?? 0) +
    portfolioOutcomeNoteDrafts(state, workItemId).length
  )
}

export function applyPortfolioOutcomeReportCommand(
  state: PortfolioState,
  command: { kind: string },
  id: string,
  now: number
): boolean {
  if (!PortfolioOutcomeReportCommands.some((schema) => schema.shape.kind.value === command.kind)) {
    return false
  }
  const typed = command as ReportCommand
  const item = state.workItems.find((entry) => entry.id === typed.workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists.')
  }
  if (typed.kind === 'workItem.report') {
    if (item.status === 'accepted') {
      throw new Error('This outcome is signed off. Tell the user in your session instead.')
    }
    const { report } = typed
    if (
      report.taskId &&
      !state.tasks.some((task) => task.id === report.taskId && task.workItemId === item.id)
    ) {
      throw new Error('The task does not belong to this outcome.')
    }
    if ((item.reports?.length ?? 0) >= MAX_REPORTS) {
      throw new Error(
        'This outcome has too many open questions. Ask the user to review them first.'
      )
    }
    item.reports = [...(item.reports ?? []), { ...report, id, at: now }]
    return true
  }
  const report = item.reports?.find((entry) => entry.id === typed.reportId)
  if (!report) {
    throw new Error('This question was already resolved. Refresh the initiative.')
  }
  const rest = (item.reports ?? []).filter((entry) => entry.id !== typed.reportId)
  if (rest.length) {
    item.reports = rest
  } else {
    delete item.reports
  }
  const task = state.tasks.find((entry) => entry.id === report.taskId)
  item.history.push({
    id: `${item.id}:${item.history.length}`,
    at: now,
    status: item.status,
    note: `Resolved a question${task ? ` from ${task.title}` : ''}${typed.note ? `: ${typed.note}` : ''}`
  })
  return true
}
