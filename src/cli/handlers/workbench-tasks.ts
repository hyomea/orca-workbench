import type { CommandHandler, HandlerContext } from '../dispatch'
import { readCommandBody } from '../command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { getRequiredWorktreeSelector, resolveCurrentWorktreeSelection } from '../selectors'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { PortfolioCommit, type PortfolioState, type PortfolioTask } from '../../shared/portfolio'
import { RuntimeClientError } from '../runtime-client'
import type { GitStatusResult } from '../../shared/git/status/git-status-types'
import { LOCAL_ONLY, read } from './workbench-client'

// Matches the stored limit for a task transition note.
const MAX_PORTFOLIO_EVIDENCE_CHARACTERS = 20_000

async function startTask(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const taskId = getRequiredStringFlag(ctx.flags, 'task')
  // Accept any worktree selector, like other worktree commands; launch takes the resolved id.
  const { worktree } = (
    await ctx.client.call<{ worktree: { id: string } }>('worktree.show', {
      worktree: await getRequiredWorktreeSelector(ctx.flags, 'worktree', ctx.cwd, ctx.client)
    })
  ).result
  const state = await read(ctx)
  const response = await ctx.client.call<PortfolioState>('portfolio.launch', {
    revision: state.revision,
    taskId,
    worktreeId: worktree.id
  })
  printResult(response, ctx.json, (next) => {
    const attempt = next.tasks.find((task) => task.id === taskId)?.attempts.at(-1)
    return `Task started (${attempt?.state ?? 'unknown'}).${attempt?.warning ? ` ${attempt.warning}` : ''}`
  })
}

// Without an id, the task is the one running in the caller's workspace; agents rarely keep the id.
async function currentTask(ctx: HandlerContext, state: PortfolioState): Promise<PortfolioTask> {
  const taskId = getOptionalStringFlag(ctx.flags, 'task')
  if (taskId) {
    const task = state.tasks.find((entry) => entry.id === taskId)
    if (!task) {
      throw new RuntimeClientError('invalid_argument', `No Workbench task has id ${taskId}.`)
    }
    return task
  }
  const { worktreeId } = await resolveCurrentWorktreeSelection(ctx.cwd, ctx.client)
  const running = state.tasks.filter(
    (task) => task.status === 'running' && task.attempts.at(-1)?.worktreeId === worktreeId
  )
  if (running.length !== 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      running.length === 0
        ? 'No running Workbench task uses this workspace. Pass the task id.'
        : `Several running Workbench tasks use this workspace (${running.map((task) => task.id).join(', ')}). Pass the task id.`
    )
  }
  return running[0]
}

// The user reviews a fixed version: everything must be committed, and that commit is recorded.
async function committedHead(ctx: HandlerContext, task: PortfolioTask): Promise<string> {
  const worktreeId = task.attempts.at(-1)?.worktreeId
  if (!worktreeId) {
    throw new RuntimeClientError('invalid_argument', `Task ${task.id} has no workspace.`)
  }
  const { result } = await ctx.client.call<GitStatusResult>('git.status', {
    worktree: `id:${worktreeId}`
  })
  // Porcelain reports "(initial)" before the first commit.
  if (result.readError || !PortfolioCommit.safeParse(result.head).success) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Cannot read the task workspace's Git state: ${result.readError ?? 'no commit is checked out'}.`
    )
  }
  if (result.entries.length > 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `The task workspace has ${result.entries.length} uncommitted change(s). Commit the work on the task branch, then run this again.`
    )
  }
  return result.head as string
}

async function submitTask(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const evidence = await readCommandBody(ctx.flags, ctx.cwd, {
    required: true,
    maximumCharacters: MAX_PORTFOLIO_EVIDENCE_CHARACTERS,
    tooLargeCode: 'evidence_too_large',
    label: 'Evidence'
  })
  const state = await read(ctx)
  const task = await currentTask(ctx, state)
  const taskId = task.id
  // Only work in progress is submitted; a planned or decided task is the user's to move.
  if (task.status !== 'running') {
    throw new RuntimeClientError(
      'invalid_argument',
      `Task ${taskId} is ${task.status}; only a running task can be submitted for review.`
    )
  }
  const commit = await committedHead(ctx, task)
  const response = await ctx.client.call<PortfolioState>('portfolio.mutate', {
    revision: state.revision,
    command: { kind: 'task.transition', taskId, status: 'review', note: evidence, commit }
  })
  printResult(
    response,
    ctx.json,
    () => 'Submitted for review. The user decides whether to accept it.'
  )
}

// The development agent marks a step done once it is committed; the step records that commit.
async function markStep(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, LOCAL_ONLY)
  const stepId = getRequiredStringFlag(ctx.flags, 'step')
  const undo = ctx.flags.get('undo') === true
  const state = await read(ctx)
  const task = await currentTask(ctx, state)
  if (task.status !== 'running') {
    throw new RuntimeClientError(
      'invalid_argument',
      `Task ${task.id} is ${task.status}; only a running task's steps can change.`
    )
  }
  const commit = undo ? undefined : await committedHead(ctx, task)
  const response = await ctx.client.call<PortfolioState>('portfolio.mutate', {
    revision: state.revision,
    command: {
      kind: 'task.step',
      taskId: task.id,
      stepId,
      done: !undo,
      ...(commit ? { commit } : {})
    }
  })
  printResult(response, ctx.json, (next) => {
    const steps = next.tasks.find((entry) => entry.id === task.id)?.steps ?? []
    const done = steps.filter((step) => step.done).length
    return `${undo ? 'Step reopened' : `Step done at ${commit}`}. ${done} of ${steps.length} steps done.`
  })
}

export const WORKBENCH_TASK_HANDLERS: Record<string, CommandHandler> = {
  'workbench task start': startTask,
  'workbench task submit': submitTask,
  'workbench task step': markStep
}
