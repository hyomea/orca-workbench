import { afterEach, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import { WORKBENCH_OUTCOME_HANDLERS } from './workbench-outcomes'

vi.mock('../selectors', () => ({
  resolveCurrentWorktreeSelection: vi.fn(async () => ({ worktreeId: 'w1' }))
}))

afterEach(() => vi.clearAllMocks())

const propose = WORKBENCH_OUTCOME_HANDLERS['workbench outcome propose']

function context(tasks: unknown[], flags: [string, string][] = []) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const call = vi.fn(async (method: string) => ({
    id: 'r',
    ok: true,
    result:
      method === 'portfolio.workbenches'
        ? [{ id: 'default', name: 'Ludus', stewardPath: '/data/steward' }]
        : method === 'portfolio.read'
          ? { revision: 3, workItems: [{ id: 'o1' }, { id: 'o2' }], tasks }
          : { proposalId: 'p1' }
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['kind', 'decision'],
      ['text', 'No retry on a failed upload'],
      ...flags
    ]),
    client: { call, isRemote: false },
    cwd: '/work/ENG-8339',
    json: true
  } as unknown as HandlerContext
  return { call, ctx }
}

it('proposes to the outcome of the session open in this workspace, crediting its task', async () => {
  const { call, ctx } = context([
    // A finished session of another outcome in the same workspace does not count.
    { id: 'old', workItemId: 'o2', attempts: [{ worktreeId: 'w1', state: 'closed' }] },
    { id: 'review', workItemId: 'o1', attempts: [{ worktreeId: 'w1', state: 'launched' }] }
  ])
  await propose(ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.proposeChecklist', {
    workbenchId: 'default',
    workItemId: 'o1',
    proposal: {
      kind: 'decision',
      text: 'No retry on a failed upload',
      reason: '',
      taskId: 'review'
    }
  })
})

it('asks for --outcome when sessions of two outcomes are open here', async () => {
  const { ctx } = context([
    { id: 'a', workItemId: 'o1', attempts: [{ worktreeId: 'w1', state: 'launched' }] },
    { id: 'b', workItemId: 'o2', attempts: [{ worktreeId: 'w1', state: 'launched' }] }
  ])
  await expect(propose(ctx)).rejects.toThrow('Pass --outcome')
})

it('rejects a kind other than criterion or decision', async () => {
  const { ctx } = context([], [['kind', 'note']])
  await expect(propose(ctx)).rejects.toThrow('--kind must be criterion or decision')
})

it('reports a question to the outcome of the session open in this workspace', async () => {
  const { call, ctx } = context(
    [{ id: 'dev', workItemId: 'o1', attempts: [{ worktreeId: 'w1', state: 'launched' }] }],
    [['body', 'Rebase onto origin/development before the PR?']]
  )
  await WORKBENCH_OUTCOME_HANDLERS['workbench outcome report'](ctx)
  expect(call).toHaveBeenLastCalledWith('portfolio.reportOutcome', {
    workbenchId: 'default',
    workItemId: 'o1',
    report: { body: 'Rebase onto origin/development before the PR?', taskId: 'dev' }
  })
})
