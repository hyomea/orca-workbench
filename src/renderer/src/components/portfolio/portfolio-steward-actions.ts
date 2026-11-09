import { z } from 'zod'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { activateLocalFolderWorkspace } from './portfolio-folder-workspace'
import { activeWorkbenchParams } from './workbench-selection'
import { sendMessageToAgent } from '@/lib/agent-session/messaging/agent-message-send'
import type { AgentMessageTarget } from '@/lib/agent-session/messaging/agent-message-target'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'

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

// One steward workspace per workbench; reopening returns to a running steward instead of starting another.
// A prompt (the user pressed a button that asks the steward something) goes to the running chat,
// or starts a new one with it.
export async function openPortfolioSteward(prompt?: string): Promise<void> {
  const { path } = z
    .object({ path: z.string().min(1) })
    .parse(
      await callRuntimeRpc({ kind: 'local' }, 'portfolio.prepareSteward', activeWorkbenchParams())
    )
  const worktreeId = await activateLocalFolderWorkspace(path, 'folder')
  if (stewardRunning(useAppStore.getState(), worktreeId)) {
    if (prompt) {
      await sendToSteward(worktreeId, prompt)
    }
    return
  }
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    requestedSurface: 'chat',
    agent: 'claude',
    worktreeId,
    ...(prompt ? { prompt } : {}),
    // The user's own Claude Code permissions, as outside Orca.
    sessionOptions: { permissionMode: 'own' },
    launchSource: 'task_page'
  })
  if (!result) {
    throw new Error(translate('portfolio.stewardLaunchFailed', 'Could not start the steward chat.'))
  }
}

async function sendToSteward(worktreeId: string, prompt: string): Promise<void> {
  const state = useAppStore.getState()
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const chat = tabs.find((tab) => tab.contentType === 'agent-session')
  const tabIds = new Set(tabs.map((tab) => tab.id))
  const pane = Object.values(state.agentStatusByPaneKey)
    .map((entry) => parsePaneKey(entry.paneKey))
    .find((key) => key && tabIds.has(key.tabId))
  const target: AgentMessageTarget | null = chat
    ? { kind: 'structured-session', sessionId: chat.entityId }
    : pane
      ? { kind: 'terminal', tabId: pane.tabId, leafId: pane.leafId }
      : null
  const result = target ? await sendMessageToAgent({ worktreeId, target, prompt }) : null
  if (result?.status !== 'sent' && result?.status !== 'unconfirmed') {
    throw new Error(
      translate(
        'portfolio.stewardSendFailed',
        'The steward is open, but the message could not be sent. Paste it into its chat:\n\n{{prompt}}',
        { prompt }
      )
    )
  }
}
