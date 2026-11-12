import { expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: vi.fn() }))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: vi.fn()
}))
vi.mock('./portfolio-folder-workspace', () => ({ activateLocalFolderWorkspace: vi.fn() }))

const { stewardRunning, runningCoordinatorMatchesAgent } =
  await import('./portfolio-steward-actions')

const LEAF = '4f5c2a1e-8b9d-4c3e-a2f1-0d9e8c7b6a50'

function state(
  tabs: { id: string; contentType: string; agentSessionAgent?: string }[],
  statuses: Record<string, { paneKey: string; restoredUnconfirmed?: boolean; agentType?: string }>
) {
  return {
    unifiedTabsByWorktree: { steward: tabs },
    agentStatusByPaneKey: statuses
  } as unknown as Pick<AppState, 'unifiedTabsByWorktree' | 'agentStatusByPaneKey'>
}

it('starts a new steward when its workspace only has a shell left', () => {
  expect(stewardRunning(state([{ id: 'shell', contentType: 'terminal' }], {}), 'steward')).toBe(
    false
  )
  // An agent in another workspace, or one only restored from before a restart, is not the steward.
  expect(
    stewardRunning(
      state([{ id: 'shell', contentType: 'terminal' }], {
        a: { paneKey: `other:${LEAF}` },
        b: { paneKey: `shell:${LEAF}`, restoredUnconfirmed: true }
      }),
      'steward'
    )
  ).toBe(false)
})

it('does not reuse a Claude steward session after Codex is selected', () => {
  const active = state(
    [{ id: 'chat', contentType: 'agent-session', agentSessionAgent: 'claude' }],
    {}
  )
  expect(stewardRunning(active, 'steward')).toBe(true)
  expect(runningCoordinatorMatchesAgent(active, 'steward', 'codex')).toBe(false)
  expect(runningCoordinatorMatchesAgent(active, 'steward', 'claude')).toBe(true)
})

it('returns to a steward that is running in a terminal or a chat tab', () => {
  expect(
    stewardRunning(
      state([{ id: 'shell', contentType: 'terminal' }], { a: { paneKey: `shell:${LEAF}` } }),
      'steward'
    )
  ).toBe(true)
  expect(stewardRunning(state([{ id: 'chat', contentType: 'agent-session' }], {}), 'steward')).toBe(
    true
  )
})
