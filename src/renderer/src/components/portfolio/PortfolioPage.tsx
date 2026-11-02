import { z } from 'zod'
import { MAX_PORTFOLIO_IMAGE_BYTES } from '../../../../shared/portfolio-design'
import { PortfolioDesignContext, portfolioImageBase64 } from './portfolio-design-actions'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { selectFolderWorkspaces, selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import {
  parsePortfolioState,
  type PortfolioState,
  type PortfolioCommand
} from '../../../../shared/portfolio'
import {
  folderWorkspaceRepoId,
  folderWorkspaceToWorktree
} from '../../../../shared/folder-workspace-worktree'
import { PortfolioBoard } from './PortfolioBoard'
import { portfolioSetupActions } from './portfolio-setup-actions'
import { openPortfolioSteward } from './portfolio-steward-actions'

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
    const next = parsePortfolioState(value)
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
    <PortfolioDesignContext
      value={{
        attach: async (workItemId, file) => {
          if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
            throw new Error(
              translate('portfolio.imageTooLarge', 'Choose an image no larger than 5 MiB.')
            )
          }
          return mutate('portfolio.attachDesign', {
            workItemId,
            name: file.name,
            mimeType: file.type,
            base64: await portfolioImageBase64(file)
          })
        },
        remove: (workItemId, attachmentId) =>
          mutate('portfolio.removeDesign', { workItemId, attachmentId }),
        read: async (attachmentId) => {
          const image = z
            .object({
              mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
              base64: z.string()
            })
            .parse(
              await callRuntimeRpc({ kind: 'local' }, 'portfolio.readDesign', { attachmentId })
            )
          return `data:${image.mimeType};base64,${image.base64}`
        }
      }}
    >
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
        onOpenSteward={() => {
          setError('')
          openPortfolioSteward().catch((failure: unknown) =>
            setError(failure instanceof Error ? failure.message : String(failure))
          )
        }}
        onExportNotes={async (projectId) => {
          const directory = await window.api.shell.pickDirectory({})
          if (!directory) {
            return null
          }
          const result = z.object({ written: z.number() }).parse(
            await callRuntimeRpc({ kind: 'local' }, 'portfolio.exportNotes', {
              projectId,
              directory
            })
          )
          return { directory, written: result.written }
        }}
        onOpenWorkspace={(id) => {
          if (setActiveWorktree(id, 'local')) {
            setActiveView('terminal')
          }
        }}
      />
    </PortfolioDesignContext>
  )
}
