import { resolve } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { readCommandBody } from '../command-body-input'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError } from '../runtime-client'
import type { PortfolioAttempt, PortfolioState, PortfolioTask } from '../../shared/portfolio'
import { portfolioRoleLabel } from '../../shared/portfolio-roles'
import { portfolioRunAgainMessage } from '../../shared/portfolio-task-messages'
import { portfolioReviewedCommit, portfolioStageCommit } from '../../shared/portfolio-track-commits'
import { terminalSendHandler } from './terminal-send'
import {
  inside,
  LOCAL_ONLY,
  read,
  readTaskWorkbench,
  type WorkbenchScope
} from './workbench-client'

const MAX_MESSAGE_CHARACTERS = 20_000

type CoordinatedTask = {
  scope: WorkbenchScope
  state: PortfolioState
  task: PortfolioTask
  attempt: PortfolioAttempt
  from: string
}

// Only the coordinator holding the task's outcome reaches its session, from its own folder; the
// coordinator's settings make Claude Code ask the user before each of these commands runs.
async function coordinatedTask(ctx: HandlerContext): Promise<CoordinatedTask> {
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  const { scope, state } = await readTaskWorkbench(ctx, (entry) => entry.id === taskId)
  const task = state.tasks.find((entry) => entry.id === taskId)
  if (!task) {
    throw new RuntimeClientError('invalid_argument', `No Workbench task has id ${taskId}.`)
  }
  const item = state.workItems.find((entry) => entry.id === task.workItemId)
  if (!item?.coordinator || !inside(resolve(ctx.cwd), item.coordinator.path)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Only the coordinator holding this task’s outcome can do this, from its own folder. Ask the user to do it from Workbench or paste the message instead.'
    )
  }
  const attempt = task.attempts.at(-1)
  if (!attempt || attempt.state !== 'launched') {
    throw new RuntimeClientError(
      'invalid_argument',
      `Task ${task.id} has no open session. Ask the user before starting a new one with \`task start\`.`
    )
  }
  const role = state.roles.find((entry) => entry.id === item.coordinator?.roleId)
  return {
    scope,
    state,
    task,
    attempt,
    from: role ? portfolioRoleLabel(role) : 'Outcome coordinator'
  }
}

type TerminalRow = { handle: string; tabId?: string; leafId?: string }

// The task's terminal by the handle its launch reported, or by its pane after a restart.
async function taskTerminal(ctx: HandlerContext, attempt: PortfolioAttempt): Promise<string> {
  const { result } = await ctx.client.call<{ terminals: TerminalRow[] }>('terminal.list', {
    worktree: `id:${attempt.worktreeId}`
  })
  const found =
    result.terminals.find((entry) => entry.handle === attempt.handle) ??
    result.terminals.find(
      (entry) => attempt.paneKey && `${entry.tabId}:${entry.leafId}` === attempt.paneKey
    )
  if (!found) {
    throw new RuntimeClientError(
      'invalid_argument',
      'The task’s terminal is not open. Ask the user to paste the message into its session.'
    )
  }
  return found.handle
}

// Sent as a prompt: the agent receives it as the user's next message and submits it.
async function send(ctx: HandlerContext, attempt: PortfolioAttempt, text: string): Promise<void> {
  const terminal = await taskTerminal(ctx, attempt)
  await terminalSendHandler({
    ...ctx,
    flags: new Map<string, string | boolean>([
      ['terminal', terminal],
      ['text', text],
      ['enter', true]
    ])
  })
}

async function messageTask(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const body = await readCommandBody(ctx.flags, ctx.cwd, {
    required: true,
    maximumCharacters: MAX_MESSAGE_CHARACTERS,
    tooLargeCode: 'message_too_large',
    label: 'Message'
  })
  const { scope, task, attempt, from } = await coordinatedTask(ctx)
  await send(
    ctx,
    attempt,
    `Message from ${from}, the coordinator of this outcome, sent with the user's approval:\n\n${body}`
  )
  const response = await ctx.client.call<PortfolioState>('portfolio.mutate', {
    ...scope,
    revision: (await read(ctx, scope)).revision,
    command: { kind: 'task.recordMessage', taskId: task.id, from, note: body }
  })
  printResult(response, ctx.json, () => `Sent to task ${task.id} and recorded in its history.`)
}

// Code review or QA looks at development's latest submission in the session it already has.
async function runAgain(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const { scope, state, task, attempt } = await coordinatedTask(ctx)
  const commit = portfolioStageCommit(state, task)
  if (!commit) {
    throw new RuntimeClientError('invalid_argument', 'Development has no submitted commit yet.')
  }
  const since = portfolioReviewedCommit(state, task)
  const response = await ctx.client.call<PortfolioState>('portfolio.mutate', {
    ...scope,
    revision: state.revision,
    command: { kind: 'task.runAgain', taskId: task.id }
  })
  await send(ctx, attempt, portfolioRunAgainMessage(task, commit, since))
  printResult(response, ctx.json, () => `Task ${task.id} is looking at ${commit} in its session.`)
}

export const WORKBENCH_COORDINATOR_HANDLERS: Record<string, CommandHandler> = {
  'workbench task message': messageTask,
  'workbench task again': runAgain
}
