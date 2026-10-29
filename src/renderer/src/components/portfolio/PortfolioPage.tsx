import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { selectFolderWorkspaces, selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { PortfolioState, type PortfolioCommand } from '../../../../shared/portfolio'
import {
  folderWorkspaceRepoId,
  folderWorkspaceToWorktree
} from '../../../../shared/folder-workspace-worktree'
import { PortfolioBoard } from './PortfolioBoard'
import { portfolioSetupActions } from './portfolio-setup-actions'

export default function PortfolioPage(): React.JSX.Element {
  const [state, setState] = useState<PortfolioState | null>(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const changing = useRef(false)
  const profileId = useAppStore((s) => s.activeOrcaProfileId)
  const repos = useAppStore((s) => s.repos)
  const worktrees = useAppStore(selectWorktreesByRepo)
  const folders = useAppStore(selectFolderWorkspaces)
  const groups = useAppStore((s) => s.projectGroups)
  const activity = useAppStore((s) => s.agentStatusByPaneKey)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const accept = useCallback((value: unknown) => {
    const next = PortfolioState.parse(value)
    setState((current) => (!current || next.revision >= current.revision ? next : current))
  }, [])
  const refresh = useCallback(async () => {
    try {
      accept(await callRuntimeRpc({ kind: 'local' }, 'portfolio.read', {}))
      setLoadError('')
    } catch (failure) {
      setLoadError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [accept])
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function poll(): Promise<void> {
      if (!changing.current && document.visibilityState !== 'hidden') {
        await refresh()
      }
      if (!stopped) {
        timer = setTimeout(() => void poll(), 5000)
      }
    }
    void poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [refresh])
  async function mutate(method: string, params: Record<string, unknown>): Promise<boolean> {
    if (!state || changing.current) {
      return false
    }
    changing.current = true
    setBusy(true)
    setError('')
    try {
      accept(
        await callRuntimeRpc({ kind: 'local' }, method, { revision: state.revision, ...params })
      )
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      return false
    } finally {
      changing.current = false
      setBusy(false)
    }
  }
  if (!state) {
    return (
      <div className="space-y-4 p-6">
        <p role={loadError ? 'alert' : 'status'}>
          {loadError || translate('portfolio.loading', 'Loading projects…')}
        </p>
        {loadError && (
          <Button variant="outline" onClick={() => void refresh()}>
            {translate('portfolio.retry', 'Retry')}
          </Button>
        )}
      </div>
    )
  }
  const localRepos = repos.filter(
    (repo) => !repo.connectionId && (!repo.executionHostId || repo.executionHostId === 'local')
  )
  const localIds = new Set(localRepos.map((repo) => repo.id))
  const localFolders = folders.filter(
    (folder) =>
      !folder.isArchived &&
      !folder.connectionId &&
      (!folder.executionHostId || folder.executionHostId === 'local')
  )
  const folderGroups = [...new Set(localFolders.map((folder) => folder.projectGroupId))].map(
    (id) => ({
      id: folderWorkspaceRepoId(id),
      name:
        groups.find((group) => group.id === id)?.name ?? translate('portfolio.folders', 'Folders')
    })
  )
  for (const group of folderGroups) {
    localIds.add(group.id)
  }
  const workspaces = [
    ...Object.values(worktrees).flat(),
    ...localFolders.map(folderWorkspaceToWorktree)
  ]
    .filter(
      (worktree) =>
        !worktree.isArchived &&
        localIds.has(worktree.repoId) &&
        (!worktree.hostId || worktree.hostId === 'local')
    )
    .map((worktree) => ({ id: worktree.id, repoId: worktree.repoId, name: worktree.displayName }))
  return (
    <PortfolioBoard
      draftScope={profileId ?? 'local-default'}
      setupActions={portfolioSetupActions}
      state={state}
      repos={[
        ...localRepos.map((repo) => ({ id: repo.id, name: repo.displayName })),
        ...folderGroups
      ]}
      workspaces={workspaces}
      activity={activity}
      busy={busy}
      error={error || loadError}
      onRefresh={() => {
        setError('')
        void refresh()
      }}
      onSave={(command: PortfolioCommand) => mutate('portfolio.mutate', { command })}
      onLaunch={(taskId, worktreeId) => mutate('portfolio.launch', { taskId, worktreeId })}
      onOpenWorkspace={(id) => {
        if (setActiveWorktree(id, 'local')) {
          setActiveView('terminal')
        }
      }}
    />
  )
}
