import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { resolveCurrentWorktreeSelection } from '../selectors'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import type { PortfolioState, PortfolioTask } from '../../shared/portfolio'
import { PortfolioChecklistKind } from '../../shared/portfolio-checklist'
import { RuntimeClientError } from '../runtime-client'
import { LOCAL_ONLY, readWorkbenchWhere, type WorkbenchScope } from './workbench-client'

type Target = { scope: WorkbenchScope; workItemId: string; taskId?: string }

function openHere(worktreeId: string) {
  return (task: PortfolioTask) => {
    const attempt = task.attempts.at(-1)
    return !!task.workItemId && attempt?.state !== 'closed' && attempt?.worktreeId === worktreeId
  }
}

// --outcome or --task name it; otherwise it is the outcome of the sessions open in this workspace.
async function proposalTarget(ctx: HandlerContext): Promise<Target> {
  const workItemId = getOptionalStringFlag(ctx.flags, 'outcome')
  const taskId = getOptionalStringFlag(ctx.flags, 'task')
  if (workItemId || taskId) {
    const has = (state: PortfolioState) =>
      (!workItemId || state.workItems.some((item) => item.id === workItemId)) &&
      (!taskId || state.tasks.some((task) => task.id === taskId))
    const { scope, state } = await readWorkbenchWhere(ctx, has)
    const task = state.tasks.find((entry) => entry.id === taskId)
    const outcome = workItemId ?? task?.workItemId
    if (!has(state) || !outcome) {
      throw new RuntimeClientError(
        'invalid_argument',
        task
          ? `Task ${task.id} has no outcome. Pass --outcome.`
          : `No Workbench ${workItemId ? `outcome has id ${workItemId}` : `task has id ${taskId}`}.`
      )
    }
    return { scope, workItemId: outcome, ...(taskId ? { taskId } : {}) }
  }
  const { worktreeId } = await resolveCurrentWorktreeSelection(ctx.cwd, ctx.client)
  const { scope, state } = await readWorkbenchWhere(ctx, (data) =>
    data.tasks.some(openHere(worktreeId))
  )
  const open = state.tasks.filter(openHere(worktreeId))
  const outcomes = [...new Set(open.map((task) => task.workItemId as string))]
  if (outcomes.length !== 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      outcomes.length === 0
        ? 'No open Workbench task in this workspace belongs to an outcome. Pass --outcome.'
        : `Tasks for several outcomes are open in this workspace (${outcomes.join(', ')}). Pass --outcome.`
    )
  }
  return { scope, workItemId: outcomes[0], ...(open.length === 1 ? { taskId: open[0].id } : {}) }
}

async function proposeChecklist(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const kind = PortfolioChecklistKind.safeParse(getRequiredStringFlag(ctx.flags, 'kind'))
  if (!kind.success) {
    throw new RuntimeClientError('invalid_argument', '--kind must be criterion or decision.')
  }
  const text = getRequiredStringFlag(ctx.flags, 'text')
  const itemId = getOptionalStringFlag(ctx.flags, 'item')
  const { scope, workItemId, taskId } = await proposalTarget(ctx)
  const response = await ctx.client.call<{ proposalId: string }>('portfolio.proposeChecklist', {
    ...scope,
    workItemId,
    proposal: {
      kind: kind.data,
      text,
      reason: getOptionalStringFlag(ctx.flags, 'reason') ?? '',
      ...(itemId ? { itemId } : {}),
      ...(taskId ? { taskId } : {})
    }
  })
  printResult(
    response,
    ctx.json,
    () =>
      'Proposed in the outcome’s inbox. The checklist changes only if the user accepts it; Workbench then tells the open sessions.'
  )
}

export const WORKBENCH_OUTCOME_HANDLERS: Record<string, CommandHandler> = {
  'workbench outcome propose': proposeChecklist
}
