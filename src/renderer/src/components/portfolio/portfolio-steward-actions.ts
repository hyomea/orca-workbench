import { z } from 'zod'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'

// One steward workspace per profile; reopening returns to its tabs instead of starting a new session.
export async function openPortfolioSteward(): Promise<void> {
  const { path } = z
    .object({ path: z.string().min(1) })
    .parse(await callRuntimeRpc({ kind: 'local' }, 'portfolio.prepareSteward', {}))
  const store = useAppStore.getState()
  const repo = await store.addRepoPath(path, 'folder', { runtimeEnvironmentId: null })
  if (!repo) {
    throw new Error(
      translate('portfolio.stewardUnavailable', 'Could not open the steward workspace.')
    )
  }
  await store.fetchWorktrees(repo.id, { executionHostId: 'local' })
  const worktree = useAppStore.getState().worktreesByRepo[repo.id]?.[0]
  if (!worktree) {
    throw new Error(
      translate('portfolio.stewardUnavailable', 'Could not open the steward workspace.')
    )
  }
  const opened = (useAppStore.getState().unifiedTabsByWorktree[worktree.id]?.length ?? 0) > 0
  if (!useAppStore.getState().setActiveWorktree(worktree.id, 'local')) {
    throw new Error(
      translate('portfolio.stewardUnavailable', 'Could not open the steward workspace.')
    )
  }
  useAppStore.getState().setActiveView('terminal')
  if (opened) {
    return
  }
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    requestedSurface: 'chat',
    agent: 'claude',
    worktreeId: worktree.id,
    // The user's own Claude Code permissions, as outside Orca.
    sessionOptions: { permissionMode: 'own' },
    launchSource: 'task_page'
  })
  if (!result) {
    throw new Error(translate('portfolio.stewardLaunchFailed', 'Could not start the steward chat.'))
  }
}
