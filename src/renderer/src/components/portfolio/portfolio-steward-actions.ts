import { z } from 'zod'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status-worktree-attribution'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { activateLocalFolderWorkspace } from './portfolio-folder-workspace'

// A tab alone does not mean the steward is there: after a restart its workspace keeps a plain
// shell, and an agent can exit. Only a chat tab or a pane with agent status counts.
export function stewardRunning(
  state: Pick<AppState, 'unifiedTabsByWorktree' | 'agentStatusByPaneKey'>,
  worktreeId: string
): boolean {
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  if (tabs.some((tab) => tab.contentType === 'agent-session')) {
    return true
  }
  const tabIds = new Set(tabs.map((tab) => tab.id))
  return Object.values(state.agentStatusByPaneKey).some((entry) => {
    const tabId = parseAgentStatusPaneIdentity(entry.paneKey)?.tabId
    return !entry.restoredUnconfirmed && tabId !== undefined && tabIds.has(tabId)
  })
}

// One steward workspace per profile; reopening returns to a running steward instead of starting another.
export async function openPortfolioSteward(): Promise<void> {
  const { path } = z
    .object({ path: z.string().min(1) })
    .parse(await callRuntimeRpc({ kind: 'local' }, 'portfolio.prepareSteward', {}))
  const worktreeId = await activateLocalFolderWorkspace(path, 'folder')
  if (stewardRunning(useAppStore.getState(), worktreeId)) {
    return
  }
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    requestedSurface: 'chat',
    agent: 'claude',
    worktreeId,
    // The user's own Claude Code permissions, as outside Orca.
    sessionOptions: { permissionMode: 'own' },
    launchSource: 'task_page'
  })
  if (!result) {
    throw new Error(translate('portfolio.stewardLaunchFailed', 'Could not start the steward chat.'))
  }
}
