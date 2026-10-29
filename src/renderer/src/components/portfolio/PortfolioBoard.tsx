import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  portfolioProgress,
  type PortfolioCommand,
  type PortfolioState
} from '../../../../shared/portfolio'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { PortfolioComposer, type PortfolioComposerKind } from './PortfolioComposer'
import { PortfolioTaskDetail, type PortfolioWorkspace } from './PortfolioTaskDetail'

export function PortfolioBoard({
  state,
  repos,
  workspaces,
  activity,
  busy,
  error,
  onRefresh,
  onSave,
  onLaunch,
  onOpenWorkspace
}: {
  state: PortfolioState
  repos: readonly { id: string; name: string }[]
  workspaces: readonly PortfolioWorkspace[]
  activity: Readonly<Record<string, AgentStatusEntry>>
  busy: boolean
  error: string
  onRefresh: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onLaunch: (taskId: string, worktreeId: string) => Promise<boolean>
  onOpenWorkspace: (id: string) => void
}): React.JSX.Element {
  useTranslation()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [composer, setComposer] = useState<PortfolioComposerKind | null>(null)
  const project =
    state.projects.find((entry) => entry.id === selectedProjectId) ?? state.projects[0]
  const tasks = state.tasks.filter((task) => task.projectId === project?.id)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const projectWorkspaces = workspaces.filter((workspace) =>
    project?.repoIds.includes(workspace.repoId)
  )
  const progress = portfolioProgress(state.tasks)
  const columns = [
    { id: 'todo', name: translate('portfolio.planned', 'Planned') },
    { id: 'running', name: translate('portfolio.running', 'Running') },
    { id: 'blocked', name: translate('portfolio.blocked', 'Blocked') },
    { id: 'review', name: translate('portfolio.review', 'In review') },
    { id: 'accepted', name: translate('portfolio.accepted', 'Accepted') }
  ] as const
  const attempt = selectedTask?.attempts.at(-1)
  const observation = attempt
    ? Object.values(activity).find(
        (entry) =>
          ((attempt.paneKey && entry.paneKey === attempt.paneKey) ||
            (attempt.handle && entry.terminalHandle === attempt.handle)) &&
          !entry.restoredUnconfirmed &&
          (entry.evidenceObservedAt ?? entry.updatedAt) >= attempt.createdAt
      )
    : undefined

  return (
    <div className="@container flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-5" />
            <h1 className="text-lg font-semibold">
              {translate('portfolio.navigation', 'Projects')}
            </h1>
          </div>
          <Button variant="link" size="sm" onClick={() => setComposer('organization')}>
            {state.organization}
          </Button>
          <p className="text-sm text-muted-foreground">
            {translate(
              'portfolio.overview',
              '{{accepted}} of {{total}} tasks accepted · {{percent}}% complete',
              progress
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={onRefresh}>
            {translate('portfolio.refresh', 'Refresh')}
          </Button>
          <Button variant="outline" onClick={() => setComposer('role')}>
            {translate('portfolio.newRole', 'New role')}
          </Button>
          <Button onClick={() => setComposer('project')}>
            <Plus />
            {translate('portfolio.newProject', 'New project')}
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="border-b px-6 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-sleek @4xl:flex-row">
        <aside className="space-y-6 border-b p-4 scrollbar-sleek @4xl:w-64 @4xl:shrink-0 @4xl:overflow-y-auto @4xl:border-r @4xl:border-b-0">
          <section className="space-y-2">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translate('portfolio.projectList', 'Business projects')}
            </h2>
            {state.projects.map((entry) => {
              const value = portfolioProgress(
                state.tasks.filter((task) => task.projectId === entry.id)
              )
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={project?.id === entry.id}
                  onClick={() => setSelectedProjectId(entry.id)}
                  className={cn(
                    'w-full rounded-md p-3 text-left hover:bg-accent',
                    project?.id === entry.id && 'bg-accent'
                  )}
                >
                  <span className="block break-words text-sm font-medium">{entry.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {value.accepted} / {value.total} · {value.percent}%
                  </span>
                </button>
              )
            })}
            {!state.projects.length && (
              <p className="text-sm text-muted-foreground">
                {translate(
                  'portfolio.noProjects',
                  'Create a project to connect repositories and track outcomes.'
                )}
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translate('portfolio.roles', 'Organization roles')}
            </h2>
            {state.roles.map((role) => (
              <div key={role.id} className="space-y-1">
                <p className="text-sm font-medium">
                  {role.name}{' '}
                  <span className="font-normal text-muted-foreground">· {role.agent}</span>
                </p>
                <p className="line-clamp-3 text-xs text-muted-foreground">{role.responsibility}</p>
              </div>
            ))}
            {!state.roles.length && (
              <p className="text-sm text-muted-foreground">
                {translate(
                  'portfolio.noRoles',
                  'Create a role with an agent and responsibility before assigning tasks.'
                )}
              </p>
            )}
          </section>
        </aside>
        <main className="min-w-0 flex-1 p-6">
          {project ? (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  <p className="max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
                    {project.objective}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {project.repoIds.map((id) => (
                      <Badge key={id} variant="outline">
                        {repos.find((repo) => repo.id === id)?.name ??
                          translate('portfolio.unavailableRepository', 'Unavailable repository')}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button disabled={!state.roles.length} onClick={() => setComposer('task')}>
                  <Plus />
                  {translate('portfolio.newTask', 'New task')}
                </Button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {translate(
                  'portfolio.progressHelp',
                  'Progress counts accepted tasks. Agent activity updates separately; a finished turn does not approve a result.'
                )}
              </p>
              <div className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-5">
                {columns.map((column) => (
                  <section key={column.id} className="min-w-0 space-y-3">
                    <h3 className="flex items-center justify-between text-sm font-medium">
                      {column.name}
                      <span className="text-xs text-muted-foreground">
                        {tasks.filter((task) => task.status === column.id).length}
                      </span>
                    </h3>
                    {tasks
                      .filter((task) => task.status === column.id)
                      .map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="w-full space-y-3 rounded-md border bg-card p-3 text-left text-card-foreground hover:bg-accent"
                        >
                          <span className="block break-words text-sm font-medium">
                            {task.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {state.roles.find((role) => role.id === task.roleId)?.name}
                          </span>
                        </button>
                      ))}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <FolderKanban className="size-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {translate(
                  'portfolio.empty',
                  'Bring work across repositories into one project. Define roles, delegate tasks, and review the results.'
                )}
              </p>
              <Button onClick={() => setComposer('project')}>
                {translate('portfolio.newProject', 'New project')}
              </Button>
            </div>
          )}
        </main>
      </div>
      {composer && (
        <PortfolioComposer
          key={composer}
          kind={composer}
          state={state}
          projectId={project?.id ?? ''}
          repos={repos}
          busy={busy}
          saveError={error}
          onClose={() => setComposer(null)}
          onSave={onSave}
        />
      )}
      {selectedTask && (
        <PortfolioTaskDetail
          key={selectedTask.id}
          task={selectedTask}
          roleName={state.roles.find((role) => role.id === selectedTask.roleId)?.name ?? ''}
          workspaces={projectWorkspaces}
          activity={observation}
          busy={busy}
          saveError={error}
          onClose={() => setSelectedTaskId('')}
          onSave={onSave}
          onLaunch={onLaunch}
          onOpenWorkspace={onOpenWorkspace}
        />
      )}
    </div>
  )
}
