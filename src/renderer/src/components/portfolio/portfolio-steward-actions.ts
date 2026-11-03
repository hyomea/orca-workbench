import { z } from 'zod'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { activateLocalFolderWorkspace } from './portfolio-folder-workspace'

// One steward workspace per profile; reopening returns to its tabs instead of starting a new session.
export async function openPortfolioSteward(): Promise<void> {
  const { path } = z
    .object({ path: z.string().min(1) })
    .parse(await callRuntimeRpc({ kind: 'local' }, 'portfolio.prepareSteward', {}))
  const worktreeId = await activateLocalFolderWorkspace(path, 'folder')
  if ((useAppStore.getState().unifiedTabsByWorktree[worktreeId]?.length ?? 0) > 0) {
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
