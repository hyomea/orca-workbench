import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'

// Opens a folder on this computer as a workspace and makes it active; returns its worktree id.
export async function activateLocalFolderWorkspace(
  path: string,
  kind: 'git' | 'folder'
): Promise<string> {
  const unavailable = () =>
    new Error(
      translate('portfolio.folderWorkspaceUnavailable', 'Could not open {{path}} in Orca.', {
        path
      })
    )
  const store = useAppStore.getState()
  const repo = await store.addRepoPath(path, kind, { runtimeEnvironmentId: null })
  if (!repo) {
    throw unavailable()
  }
  await store.fetchWorktrees(repo.id, { executionHostId: 'local' })
  const worktrees = useAppStore.getState().worktreesByRepo[repo.id] ?? []
  // A git folder lists its linked worktrees too; the checkout at the folder itself is the one asked for.
  const worktree = worktrees.find((entry) => entry.path === path) ?? worktrees[0]
  if (!worktree || !useAppStore.getState().setActiveWorktree(worktree.id, 'local')) {
    throw unavailable()
  }
  useAppStore.getState().setActiveView('terminal')
  return worktree.id
}
