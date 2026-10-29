import { FolderKanban, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { portfolioProgress, type PortfolioState } from '../../../../shared/portfolio'

export function PortfolioNavigation({
  state,
  selectedProjectId,
  onSelectProject,
  onCreateRole
}: {
  state: PortfolioState
  selectedProjectId: string
  onSelectProject: (id: string) => void
  onCreateRole: () => void
}): React.JSX.Element {
  return (
    <aside className="space-y-5 border-b border-border p-4 @3xl:w-56 @3xl:shrink-0 @3xl:overflow-y-auto @3xl:border-r @3xl:border-b-0 scrollbar-sleek">
      <section className="space-y-2">
        <div className="flex items-center justify-between px-2 text-muted-foreground">
          <h2 className="text-2xs font-semibold uppercase tracking-wider">
            {translate('portfolio.projectList', 'Business projects')}
          </h2>
          <span className="text-xs tabular-nums">{state.projects.length}</span>
        </div>
        <nav
          aria-label={translate('portfolio.projectList', 'Business projects')}
          className="flex gap-1 overflow-x-auto scrollbar-sleek @3xl:flex-col"
        >
          {state.projects.map((entry) => {
            const progress = portfolioProgress(
              state.tasks.filter((task) => task.projectId === entry.id)
            )
            const current = entry.id === selectedProjectId
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={current}
                data-current={current}
                onClick={() => onSelectProject(entry.id)}
                className={cn(
                  'w-48 shrink-0 rounded-md p-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring @3xl:w-full',
                  current && 'bg-accent'
                )}
              >
                <span className="flex items-start gap-2 text-sm font-medium">
                  <FolderKanban
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{entry.name}</span>
                </span>
                <span className="mt-1 block pl-6 text-xs text-muted-foreground">
                  {progress.total > 0
                    ? translate(
                        'portfolio.taskFraction',
                        '{{accepted}} / {{total}} accepted',
                        progress
                      )
                    : translate('portfolio.noTasksYet', 'No tasks yet')}
                </span>
              </button>
            )
          })}
        </nav>
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            {translate('portfolio.rolesShort', 'Roles')}
            <span className="tabular-nums">{state.roles.length}</span>
          </h2>
          <Button variant="ghost" size="xs" onClick={onCreateRole}>
            <Plus aria-hidden="true" />
            {translate('portfolio.addRole', 'Add role')}
          </Button>
        </div>
        {state.roles.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-sleek @3xl:flex-col">
            {state.roles.map((role) => (
              <div key={role.id} className="w-48 shrink-0 space-y-1 px-2 py-1 @3xl:w-full">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="min-w-0 break-words text-sm font-medium">{role.name}</p>
                  <span className="text-2xs text-muted-foreground">{role.agent}</span>
                </div>
                <p className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
                  {role.responsibility}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 text-xs leading-relaxed text-muted-foreground">
            {translate(
              'portfolio.rolesHint',
              'Add a role to give an agent a clear responsibility.'
            )}
          </p>
        )}
      </section>
    </aside>
  )
}
