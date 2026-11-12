import React from 'react'
import { Bot, Download, Ellipsis, FolderKanban, Plus, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'
import {
  createWorkbench,
  exportWorkbench,
  importWorkbench,
  removeWorkbench,
  selectWorkbench,
  useActiveWorkbenchId,
  useWorkbenchList
} from '@/components/portfolio/workbench-selection'
import { followWorkbenchAgents } from '@/components/portfolio/workbench-agent-names'
import { openPortfolioSteward } from '@/components/portfolio/portfolio-steward-actions'
import {
  DEFAULT_WORKBENCH_ID,
  type PortfolioWorkbenchSummary
} from '../../../../shared/rpc-contract/portfolio-params'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Workbench, with each workbench (such as the user's organization) one level below it.
export function SidebarWorkbenchNav(): React.JSX.Element {
  const t = useTranslate()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const activeId = useActiveWorkbenchId()
  const list = useWorkbenchList()
  const [naming, setNaming] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [transferring, setTransferring] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<PortfolioWorkbenchSummary | null>(null)
  const [removing, setRemoving] = React.useState(false)
  const onPage = activeView === 'portfolio'
  // Also keeps this list current, and names the agent sessions Workbench started.
  React.useEffect(() => followWorkbenchAgents(), [])
  const open = (id: string): void => {
    selectWorkbench(id)
    setActiveView('portfolio')
  }
  const openSteward = (id: string): void => {
    selectWorkbench(id)
    setError('')
    void openPortfolioSteward().catch((failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }
  const submit = async (): Promise<void> => {
    if (!name.trim()) {
      setNaming(false)
      return
    }
    try {
      await createWorkbench(name.trim())
      setActiveView('portfolio')
      setNaming(false)
      setName('')
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }
  const confirmRemove = async (): Promise<void> => {
    if (!deleteTarget) {
      return
    }
    setRemoving(true)
    try {
      await removeWorkbench(deleteTarget.id)
      setDeleteTarget(null)
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      setDeleteTarget(null)
    } finally {
      setRemoving(false)
    }
  }
  const runTransfer = async (action: () => Promise<void>): Promise<void> => {
    setTransferring(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setTransferring(false)
    }
  }
  return (
    <div>
      <div className="group flex items-center rounded-md text-[13px] font-medium text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8">
        <button
          type="button"
          onClick={() => setActiveView('portfolio')}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
        >
          <FolderKanban className="size-4 shrink-0" />
          {t('portfolio.navigation', 'Workbench')}
        </button>
        <button
          type="button"
          onClick={() => setNaming(true)}
          aria-label={t('portfolio.newWorkbench', 'New workbench')}
          className="mr-1 hidden rounded p-0.5 text-worktree-sidebar-foreground/55 hover:text-worktree-sidebar-foreground focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring group-hover:flex"
        >
          <Plus className="size-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={transferring}
              aria-label={t('portfolio.workbenchLibraryActions', 'Workbench library actions')}
              className="mr-1 rounded p-0.5 text-worktree-sidebar-foreground/55 hover:text-worktree-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
            >
              <Ellipsis className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                void runTransfer(async () => {
                  const result = await importWorkbench()
                  if (result) {
                    setActiveView('portfolio')
                    setNotice(
                      result.unlinkedProjects
                        ? t(
                            'portfolio.importWorkbenchRelink',
                            'Imported {{name}}. Relink its repositories before starting tasks.',
                            { name: result.name }
                          )
                        : t('portfolio.importWorkbenchDone', 'Imported {{name}}.', {
                            name: result.name
                          })
                    )
                  }
                })
              }
            >
              <Upload aria-hidden="true" />
              {t('portfolio.importWorkbench', 'Import workbench…')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && !naming && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="px-2 py-1 text-xs text-worktree-sidebar-foreground/70">
          {notice}
        </p>
      )}
      <ul aria-label={t('portfolio.workbenches', 'Workbenches')} className="space-y-0.5">
        {list.map((entry) => {
          const current = onPage && entry.id === activeId
          return (
            <React.Fragment key={entry.id}>
              <li className="group flex items-center rounded-md hover:bg-worktree-sidebar-foreground/8">
                <button
                  type="button"
                  onClick={() => open(entry.id)}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-w-0 flex-1 items-center rounded-md py-1 pr-1 pl-8 text-left text-[13px] transition-colors',
                    current
                      ? 'bg-worktree-sidebar-accent font-medium text-worktree-sidebar-accent-foreground'
                      : 'text-worktree-sidebar-foreground/60'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={transferring}
                      aria-label={t('portfolio.workbenchItemActions', 'Actions for {{name}}', {
                        name: entry.name
                      })}
                      className="mr-1 rounded p-0.5 text-worktree-sidebar-foreground/55 hover:text-worktree-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
                    >
                      <Ellipsis className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        void runTransfer(async () => {
                          if (await exportWorkbench(entry.id)) {
                            setNotice(t('portfolio.exportWorkbenchDone', 'Workbench exported.'))
                          }
                        })
                      }
                    >
                      <Download aria-hidden="true" />
                      {t('portfolio.exportWorkbench', 'Export workbench…')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(entry)}>
                      <Trash2 aria-hidden="true" />
                      {entry.id === DEFAULT_WORKBENCH_ID
                        ? t('portfolio.clearWorkbench', 'Clear workbench')
                        : t('portfolio.removeWorkbench', 'Remove workbench')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
              {entry.id === activeId && (
                <li>
                  <button
                    type="button"
                    onClick={() => openSteward(entry.id)}
                    className="flex w-full items-center gap-2 rounded-md py-1 pr-2 pl-10 text-left text-[13px] text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8 hover:text-worktree-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
                  >
                    <Bot className="size-3.5 shrink-0" aria-hidden="true" />
                    {t('portfolio.openStewardChat', 'Steward chat')}
                  </button>
                </li>
              )}
            </React.Fragment>
          )
        })}
        {naming && (
          <li className="py-0.5 pr-2 pl-8">
            <input
              autoFocus
              value={name}
              maxLength={200}
              aria-label={t('portfolio.workbenchName', 'Workbench name')}
              placeholder={t('portfolio.workbenchName', 'Workbench name')}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void submit()}
              onKeyDown={(event) => {
                // Enter that confirms an input method's candidate is not a submit.
                if (isImeOwnedKeyboardEvent(event)) {
                  return
                }
                if (event.key === 'Enter') {
                  void submit()
                } else if (event.key === 'Escape') {
                  setNaming(false)
                  setName('')
                }
              }}
              className="w-full rounded border border-worktree-sidebar-border bg-transparent px-1.5 py-0.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
            />
            {error && (
              <p role="alert" className="pt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </li>
        )}
      </ul>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !removing) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent size="compact">
          <DialogHeader>
            <DialogTitle size="compact">
              {deleteTarget?.id === DEFAULT_WORKBENCH_ID
                ? t('portfolio.clearWorkbench', 'Clear workbench')
                : t('portfolio.removeWorkbench', 'Remove workbench')}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.id === DEFAULT_WORKBENCH_ID
                ? t(
                    'portfolio.clearWorkbenchConfirm',
                    'Clear {{name}} and its saved Workbench data? This cannot be undone. The default workbench, other workbenches, personal notes settings, agent sessions, and workspaces remain.',
                    { name: deleteTarget?.name ?? '' }
                  )
                : t(
                    'portfolio.removeWorkbenchConfirm',
                    'Remove {{name}} and its saved Workbench data? This cannot be undone. Agent sessions and workspaces remain.',
                    { name: deleteTarget?.name ?? '' }
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={removing} onClick={() => setDeleteTarget(null)}>
              {t('portfolio.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" disabled={removing} onClick={() => void confirmRemove()}>
              {deleteTarget?.id === DEFAULT_WORKBENCH_ID
                ? t('portfolio.clearWorkbench', 'Clear workbench')
                : t('portfolio.removeWorkbench', 'Remove workbench')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
