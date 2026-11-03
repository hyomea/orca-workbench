import { afterEach, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import { WORKBENCH_HANDLERS } from './workbench'
import { WORKBENCH_HANDLER_GROUP } from '../workbench-handler-group'
import { WORKBENCH_COMMAND_SPECS } from '../specs/workbench'

afterEach(() => vi.restoreAllMocks())

it('resolves a worktree selector before starting a task', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const id = 'repo::/work/ENG-5952'
  const call = vi.fn(async (method: string, params: Record<string, unknown>) => {
    const result =
      method === 'worktree.show'
        ? { worktree: { id } }
        : method === 'portfolio.read'
          ? { revision: 7 }
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
