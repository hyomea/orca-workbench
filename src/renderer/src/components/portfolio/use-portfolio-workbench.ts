import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { translate } from '@/i18n/i18n'
import { parsePortfolioState, type PortfolioState } from '../../../../shared/portfolio'
import {
  folderWorkspaceRepoId,
  folderWorkspaceToWorktree
} from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { PortfolioWorkspace } from './PortfolioTaskDetail'
import {
  noteWorkbenchName,
  useActiveWorkbenchId,
  useWorkbenchGeneration
} from './workbench-selection'
import { noteWorkbenchAgents } from './workbench-agent-names'

export type PortfolioWorkbench = {
  state: PortfolioState | null
  error: string
  loadError: string
  busy: boolean
  setError: (error: string) => void
  refresh: () => Promise<void>
  mutate: (method: string, params: Record<string, unknown>) => Promise<boolean>
  repos: { id: string; name: string }[]
  workspaces: PortfolioWorkspace[]
}

// Workbench data and the local workspaces tasks can run in, shared by the Workbench and Tasks pages.
export function usePortfolioWorkbench(): PortfolioWorkbench {
  const [state, setState] = useState<PortfolioState | null>(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const changing = useRef(false)
  const repos = useAppStore((s) => s.repos)
  const worktrees = useAppStore(selectWorktreesByRepo)
  const folders = useAppStore(selectFolderWorkspaces)
  const groups = useAppStore((s) => s.projectGroups)
  const workbenchId = useActiveWorkbenchId()
  const generation = useWorkbenchGeneration()
  // Another workbench's data never mixes in: the state shown belongs to the selected one.
  const shownKey = `${workbenchId}:${generation}`
  const activeScope = useRef(shownKey)
  activeScope.current = shownKey
  const [shown, setShown] = useState(shownKey)
  if (shown !== shownKey) {
    setShown(shownKey)
    setState(null)
    setError('')
    setLoadError('')
  }
  const accept = useCallback(
    (value: unknown) => {
      if (activeScope.current !== shownKey) {
        return
      }
      const next = parsePortfolioState(value)
      noteWorkbenchName(workbenchId, next.organization)
      noteWorkbenchAgents(workbenchId, next)
      setState((current) => (!current || next.revision >= current.revision ? next : current))
    },
    [workbenchId, shownKey]
  )
  const refresh = useCallback(async () => {
    try {
      accept(await callRuntimeRpc({ kind: 'local' }, 'portfolio.read', { workbenchId }))
      setLoadError('')
    } catch (failure) {
      setLoadError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [accept, workbenchId])
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
        await callRuntimeRpc({ kind: 'local' }, method, {
          workbenchId,
          revision: state.revision,
          ...params
        })
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
  return {
    state,
    error,
    loadError,
    busy,
    setError,
    refresh,
    mutate,
    repos: [
      ...localRepos.map((repo) => ({ id: repo.id, name: repo.displayName })),
      ...folderGroups
    ],
    workspaces
  }
}
