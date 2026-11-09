import React from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'
import {
  createWorkbench,
  refreshWorkbenchList,
  selectWorkbench,
  useActiveWorkbenchId,
  useWorkbenchList
} from '@/components/portfolio/workbench-selection'

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
  const onPage = activeView === 'portfolio'
  React.useEffect(() => {
    refreshWorkbenchList().catch(() => {
      // The list stays empty; the Workbench page reports its own load errors.
    })
  }, [])
  const open = (id: string): void => {
    selectWorkbench(id)
    setActiveView('portfolio')
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
      </div>
      <ul aria-label={t('portfolio.workbenches', 'Workbenches')} className="space-y-0.5">
        {list.map((entry) => {
          const current = onPage && entry.id === activeId
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => open(entry.id)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center rounded-md py-1 pr-2 pl-8 text-left text-[13px] transition-colors',
                  current
                    ? 'bg-worktree-sidebar-accent font-medium text-worktree-sidebar-accent-foreground'
                    : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
                )}
              >
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </button>
            </li>
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
    </div>
  )
}
