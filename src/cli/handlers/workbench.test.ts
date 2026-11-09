import { afterEach, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import { WORKBENCH_HANDLERS } from './workbench'
import { WORKBENCH_HANDLER_GROUP } from '../workbench-handler-group'
import { WORKBENCH_COMMAND_SPECS } from '../specs/workbench'

afterEach(() => vi.restoreAllMocks())

const WORKBENCHES = [{ id: 'default', name: 'Ludus', stewardPath: '/data/workbench/steward' }]

it('resolves a worktree selector before starting a task', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const id = 'repo::/work/ENG-5952'
  const call = vi.fn(async (method: string, params: Record<string, unknown>) => {
    const result =
      method === 'worktree.show'
        ? { worktree: { id } }
        : method === 'portfolio.workbenches'
          ? WORKBENCHES
          : method === 'portfolio.read'
            ? { revision: 7, tasks: [{ id: 't1', attempts: [] }] }
            : { tasks: [{ id: 't1', attempts: [{ state: 'launched' }] }] }
    return { id: 'r', ok: true, result, params }
  })
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['task', 't1'],
      ['worktree', 'path:/work/ENG-5952']
    ]),
    client: { call, isRemote: false },
    cwd: '/tmp',
    json: true
  } as unknown as HandlerContext
  await WORKBENCH_HANDLERS['workbench task start'](ctx)
  expect(call).toHaveBeenCalledWith('worktree.show', { worktree: 'path:/work/ENG-5952' })
  expect(call).toHaveBeenLastCalledWith('portfolio.launch', {
    workbenchId: 'default',
    revision: 7,
    taskId: 't1',
    worktreeId: id
  })
})

it('routes every documented workbench command to a handler', () => {
  const commands = WORKBENCH_COMMAND_SPECS.map((spec) => spec.path.join(' ')).sort()
  expect([...WORKBENCH_HANDLER_GROUP.keys].sort()).toEqual(commands)
  expect(Object.keys(WORKBENCH_HANDLERS).sort()).toEqual(commands)
})

const HEAD = 'f3867912aa'

function submitContext(status: string, entries: unknown[] = []) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const call = vi.fn(async (method: string) => ({
    id: 'r',
    ok: true,
    result:
      method === 'portfolio.workbenches'
        ? WORKBENCHES
        : method === 'portfolio.read'
          ? { revision: 3, tasks: [{ id: 't1', status, attempts: [{ worktreeId: 'w1' }] }] }
          : method === 'git.status'
            ? { entries, conflictOperation: 'unknown', head: HEAD }
            : {}
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['task', 't1'],
      ['body', 'Tests pass: ./gradlew test']
    ]),
    client: { call, isRemote: false },
    cwd: '/tmp',
    json: true
  } as unknown as HandlerContext
  return { call, ctx }
}

it('submits a running task for review with its evidence', async () => {
  const { call, ctx } = submitContext('running')
  await WORKBENCH_HANDLERS['workbench task submit'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 3,
    command: {
      kind: 'task.transition',
      taskId: 't1',
      status: 'review',
      note: 'Tests pass: ./gradlew test',
      commit: HEAD
    }
  })
  expect(call).toHaveBeenCalledWith('git.status', { worktree: 'id:w1' })
})

it('refuses to submit work that is not committed', async () => {
  const { call, ctx } = submitContext('running', [{ path: 'app/Foo.kt', status: 'modified' }])
  await expect(WORKBENCH_HANDLERS['workbench task submit'](ctx)).rejects.toThrow(
    '1 uncommitted change(s)'
  )
  expect(call).not.toHaveBeenCalledWith('portfolio.mutate', expect.anything())
})

it('refuses to submit a task that is not running', async () => {
  const { call, ctx } = submitContext('accepted')
  await expect(WORKBENCH_HANDLERS['workbench task submit'](ctx)).rejects.toThrow(
    'only a running task can be submitted'
  )
  expect(call).not.toHaveBeenCalledWith('portfolio.mutate', expect.anything())
})

it('submits the running task of the workspace it is run from when no id is given', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const tasks = [
    { id: 't1', status: 'running', attempts: [{ worktreeId: 'repo::/work/other' }] },
    { id: 't2', status: 'running', attempts: [{ worktreeId: 'repo::/work/ENG-5952' }] }
  ]
  const call = vi.fn(async (method: string) => ({
    id: 'r',
    ok: true,
    result:
      method === 'worktree.list'
        ? { worktrees: [{ id: 'repo::/work/ENG-5952', path: '/work/ENG-5952' }] }
        : method === 'portfolio.workbenches'
          ? WORKBENCHES
          : method === 'portfolio.read'
            ? { revision: 3, tasks }
            : method === 'git.status'
              ? { entries: [], conflictOperation: 'unknown', head: HEAD }
              : {}
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([['body', 'Evidence']]),
    client: { call, isRemote: false },
    cwd: '/work/ENG-5952/app',
    json: true
  } as unknown as HandlerContext
  await WORKBENCH_HANDLERS['workbench task submit'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 3,
    command: {
      kind: 'task.transition',
      taskId: 't2',
      status: 'review',
      note: 'Evidence',
      commit: HEAD
    }
  })
  tasks[1].attempts[0].worktreeId = 'repo::/work/other'
  await expect(WORKBENCH_HANDLERS['workbench task submit'](ctx)).rejects.toThrow(
    'No running Workbench task uses this workspace'
  )
})

it('marks a step done at the committed head, and reopens it without a commit', async () => {
  const { call, ctx } = submitContext('running')
  ctx.flags.set('step', 'S2')
  await WORKBENCH_HANDLERS['workbench task step'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 3,
    command: { kind: 'task.step', taskId: 't1', stepId: 'S2', done: true, commit: HEAD }
  })
  ctx.flags.set('undo', true)
  await WORKBENCH_HANDLERS['workbench task step'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 3,
    command: { kind: 'task.step', taskId: 't1', stepId: 'S2', done: false }
  })
})

it('refuses to mark a step done before it is committed', async () => {
  const { call, ctx } = submitContext('running', [{ path: 'app/Foo.kt', status: 'modified' }])
  ctx.flags.set('step', 'S2')
  await expect(WORKBENCH_HANDLERS['workbench task step'](ctx)).rejects.toThrow(
    'Commit the work on the task branch, then run this again.'
  )
  expect(call).not.toHaveBeenCalledWith('portfolio.mutate', expect.anything())
})

it('finds the workbench that holds the task when several exist', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const call = vi.fn(async (method: string, params: { workbenchId?: string }) => ({
    id: 'r',
    ok: true,
    result:
      method === 'portfolio.workbenches'
        ? [
            ...WORKBENCHES,
            { id: 'home', name: 'Home', stewardPath: '/data/workbench/spaces/home/steward' }
          ]
        : method === 'portfolio.read'
          ? {
              revision: params.workbenchId === 'home' ? 9 : 3,
              tasks:
                params.workbenchId === 'home'
                  ? [{ id: 't9', status: 'running', attempts: [{ worktreeId: 'w9' }] }]
                  : []
            }
          : method === 'git.status'
            ? { entries: [], conflictOperation: 'unknown', head: HEAD }
            : {}
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['task', 't9'],
      ['body', 'Evidence']
    ]),
    client: { call, isRemote: false },
    cwd: '/tmp',
    json: true
  } as unknown as HandlerContext
  await WORKBENCH_HANDLERS['workbench task submit'](ctx)
  expect(call).toHaveBeenLastCalledWith(
    'portfolio.mutate',
    expect.objectContaining({ workbenchId: 'home', revision: 9 })
  )
  // Commands that are not about one task need the workbench named, unless run by its coordinator.
  await expect(WORKBENCH_HANDLERS['workbench status'](ctx)).rejects.toThrow('pass --workbench <id>')
  ctx.cwd = '/data/workbench/spaces/home/steward'
  await WORKBENCH_HANDLERS['workbench status'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.read', { workbenchId: 'home' })
})
