import {
  Circle,
  CircleCheck,
  CircleDashed,
  CirclePause,
  GitPullRequest,
  ListChecks,
  Plus
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { translate } from '@/i18n/i18n'
import {
  portfolioProgress,
  type PortfolioState,
  type PortfolioTask
} from '../../../../shared/portfolio'

export function PortfolioProjectBoard({
  project,
  tasks,
  roles,
  repos,
  onCreateTask,
  onEditProject,
  onCreateRole,
  onSelectTask
}: {
  project: PortfolioState['projects'][number]
  tasks: readonly PortfolioTask[]
  roles: PortfolioState['roles']
  repos: readonly { id: string; name: string }[]
  onCreateTask: () => void
  onEditProject: () => void
  onCreateRole: () => void
  onSelectTask: (id: string) => void
}): React.JSX.Element {
  const progress = portfolioProgress(tasks)
  const columns = [
    { id: 'todo', name: translate('portfolio.planned', 'Planned'), icon: CircleDashed },
    { id: 'running', name: translate('portfolio.running', 'Running'), icon: Circle },
    { id: 'blocked', name: translate('portfolio.blocked', 'Blocked'), icon: CirclePause },
    { id: 'review', name: translate('portfolio.review', 'In review'), icon: GitPullRequest },
    { id: 'accepted', name: translate('portfolio.accepted', 'Accepted'), icon: CircleCheck }
  ] as const

  return (
    <main className="@container/project min-w-0 flex-1 p-5 @3xl:overflow-y-auto @3xl:p-6 scrollbar-sleek">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="break-words text-xl font-semibold">{project.name}</h2>
          <p className="max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {project.objective}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {project.repoIds.map((id) => (
              <Badge key={id} variant="outline" className="max-w-full whitespace-normal break-all">
                {repos.find((repo) => repo.id === id)?.name ??
                  translate('portfolio.unavailableRepository', 'Unavailable repository')}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEditProject}>
            {translate('portfolio.editProject', 'Edit project')}
          </Button>
          {tasks.length > 0 && roles.length > 0 && (
            <Button size="sm" onClick={onCreateTask}>
              <Plus aria-hidden="true" />
              {translate('portfolio.newTask', 'New task')}
            </Button>
          )}
        </div>
      </div>
      {tasks.length > 0 ? (
        <>
          <div className="mb-6 space-y-2 border-y border-border py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">
                {translate(
                  'portfolio.acceptedSummary',
                  '{{accepted}} of {{total}} tasks accepted',
                  progress
                )}
              </span>
              <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
            </div>
            <Progress
              value={progress.percent}
              aria-label={translate('portfolio.projectProgress', 'Project completion')}
              className="h-1"
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'portfolio.acceptanceHint',
                'Progress advances when you review and accept a result.'
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 items-start gap-3 @md/project:grid-cols-2 @4xl/project:grid-cols-3 @6xl/project:grid-cols-5">
            {columns.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column.id)
              return (
                <section
                  key={column.id}
                  className="min-w-0 rounded-xl border border-border bg-muted/30 p-2"
                >
                  <h3 className="mb-2 flex items-center gap-2 px-1 py-1 text-xs font-medium">
                    <column.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {column.name}
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {columnTasks.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {columnTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onSelectTask(task.id)}
                        className="w-full space-y-4 rounded-md border border-border bg-card p-3 text-left text-card-foreground shadow-xs outline-none hover:border-muted-foreground/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block break-words text-sm font-medium leading-relaxed">
                          {task.title}
                        </span>
                        <span className="block break-words text-xs text-muted-foreground">
                          {roles.find((role) => role.id === task.roleId)?.name}
                        </span>
                      </button>
                    ))}
                    {columnTasks.length === 0 && (
                      <p className="px-1 py-5 text-center text-xs text-muted-foreground">
                        {translate('portfolio.noTasks', 'No tasks')}
                      </p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <section className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-border p-6 @md/project:p-8">
          <ListChecks className="size-7 text-muted-foreground" aria-hidden="true" />
          <div className="max-w-md space-y-2">
            <h3 className="text-base font-semibold">
              {roles.length > 0
                ? translate('portfolio.firstTask', 'Turn your outcome into a task')
                : translate('portfolio.firstRole', 'Give your first agent a role')}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {roles.length > 0
                ? translate(
                    'portfolio.firstTaskHint',
                    'Describe the work, assign a role, and define what a successful result looks like.'
                  )
                : translate(
                    'portfolio.firstRoleHint',
                    'Choose an agent and define its responsibility. Then you can assign tasks in this project.'
                  )}
            </p>
          </div>
          <Button onClick={roles.length > 0 ? onCreateTask : onCreateRole}>
            <Plus aria-hidden="true" />
            {roles.length > 0
              ? translate('portfolio.newTask', 'New task')
              : translate('portfolio.newRole', 'New role')}
          </Button>
        </section>
      )}
    </main>
  )
}
