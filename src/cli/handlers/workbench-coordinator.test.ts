import { afterEach, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import { WORKBENCH_COORDINATOR_HANDLERS } from './workbench-coordinator'

afterEach(() => vi.restoreAllMocks())

const attempt = {
  worktreeId: 'w-ios',
  state: 'launched',
  handle: 'term_old',
  paneKey: 'tab1:leaf1',
  createdAt: 4
}
const STATE = {
  revision: 9,
  roles: [{ id: 'c', name: 'Outcome coordinator', agentName: 'Mimi', coordinator: true }],
  workItems: [{ id: 'o1', coordinator: { roleId: 'c', path: '/wb/coordinators/upload', at: 1 } }],
  tasks: [
    {
      id: 'dev',
      stage: 'development',
      workItemId: 'o1',
      platform: 'ios',
      status: 'review',
      attempts: [{ ...attempt, state: 'launched' }],
      history: [
        { id: 'h1', at: 3, status: 'review', note: 'Round 2', commit: '2500b078' },
        { id: 'h2', at: 6, status: 'review', note: 'More', commit: 'ca2e945a', resubmitted: true }
      ]
    },
    {
      id: 'review',
      stage: 'codeReview',
      workItemId: 'o1',
      platform: 'ios',
      status: 'running',
      attempts: [{ ...attempt, commit: '2500b078' }],
      history: []
    }
  ]
}

function context(cwd: string, flags: [string, string | boolean][]) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const call = vi.fn(async (method: string, _params?: unknown) => ({
    id: 'r',
    ok: true,
    result:
      method === 'portfolio.workbenches'
        ? [{ id: 'default', name: 'Ludus', stewardPath: '/wb/steward' }]
        : method === 'portfolio.read'
          ? STATE
          : method === 'terminal.list'
            ? // After a restart the session runs under a new handle in the same pane.
              { terminals: [{ handle: 'term_new', tabId: 'tab1', leafId: 'leaf1' }] }
            : method === 'terminal.send'
              ? { send: { handle: 'term_new', accepted: true, bytesWritten: 10 } }
              : STATE
  }))
  const getCliStatus = vi.fn(async () => ({
    result: { runtime: { reachable: true, capabilities: [], runtimeId: 'rt' } }
  }))
  const ctx = {
    flags: new Map<string, string | boolean>(flags),
    client: { call, getCliStatus, isRemote: false },
    cwd,
    json: true
  } as unknown as HandlerContext
  return { call, ctx }
}

it('sends an approved message into the task’s session and records it', async () => {
  const { call, ctx } = context('/wb/coordinators/upload', [
    ['task', 'dev'],
    ['body', 'Remove the toast, then resubmit.']
  ])
  await WORKBENCH_COORDINATOR_HANDLERS['workbench task message'](ctx)
  const sent = call.mock.calls.find(([method]) => method === 'terminal.send')?.[1] as {
    terminal: string
    text: string
    enter: boolean
  }
  expect(sent).toMatchObject({ terminal: 'term_new', enter: true })
  expect(sent.text).toContain('Message from Mimi · Outcome coordinator')
  expect(sent.text).toContain('Remove the toast, then resubmit.')
  expect(call).toHaveBeenLastCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 9,
    command: {
      kind: 'task.recordMessage',
      taskId: 'dev',
      from: 'Mimi · Outcome coordinator',
      note: 'Remove the toast, then resubmit.'
    }
  })
})

it('refuses outside the folder of the coordinator holding the outcome', async () => {
  const { call, ctx } = context('/wb/steward', [
    ['task', 'dev'],
    ['body', 'Hi']
  ])
  await expect(WORKBENCH_COORDINATOR_HANDLERS['workbench task message'](ctx)).rejects.toThrow(
    'Only the coordinator holding this task’s outcome'
  )
  expect(call).not.toHaveBeenCalledWith('terminal.send', expect.anything(), expect.anything())
  expect(call).not.toHaveBeenCalledWith('terminal.send', expect.anything())
})

it('has a review that is behind look at the new commits, then tells its session the range', async () => {
  const { call, ctx } = context('/wb/coordinators/upload', [['task', 'review']])
  await WORKBENCH_COORDINATOR_HANDLERS['workbench task again'](ctx)
  const methods = call.mock.calls.map(([method]) => method)
  expect(methods.indexOf('portfolio.mutate')).toBeLessThan(methods.indexOf('terminal.send'))
  expect(call).toHaveBeenCalledWith('portfolio.mutate', {
    workbenchId: 'default',
    revision: 9,
    command: { kind: 'task.runAgain', taskId: 'review' }
  })
  const sent = call.mock.calls.find(([method]) => method === 'terminal.send')?.[1] as {
    text: string
  }
  expect(sent.text).toContain('Review the commits from 2500b078 to ca2e945a')
})
