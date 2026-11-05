import { useState, type ReactNode } from 'react'
import { ListChecks, Plus, SquareArrowOutUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { translate } from '@/i18n/i18n'
import {
  portfolioProgress,
  type PortfolioState,
  type PortfolioTask
} from '../../../../shared/portfolio'
import type { PortfolioReviewMode } from '../../../../shared/portfolio-task-stages'

export function PortfolioProjectBoard({
  project,
  tasks,
  roles,
  repos,
  onCreateTask,
  onEditProject,
  onCreateRole,
  onOpenTasks,
  onReviewModeChange,
  outcomeContent,
  featureContent,
  notesContent
}: {
  project: PortfolioState['projects'][number]
  tasks: readonly PortfolioTask[]
  roles: PortfolioState['roles']
  repos: readonly { id: string; name: string }[]
  onCreateTask: () => void
  onEditProject: () => void
  onCreateRole: () => void
  onOpenTasks: () => void
  onReviewModeChange?: (mode: PortfolioReviewMode) => void
  outcomeContent?: ReactNode
  featureContent?: ReactNode
  notesContent?: ReactNode
}): React.JSX.Element {
  const [view, setView] = useState(outcomeContent ? 'outcomes' : 'tasks')
  const progress = portfolioProgress(tasks)

  return (
    <main className="@container/project min-h-0 min-w-0 p-5 @3xl/portfolio:p-6">
      <header className="mb-5 space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 break-words text-lg font-semibold">{project.name}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {onReviewModeChange && (
              <ReviewModeSwitch
                mode={project.reviewMode ?? 'personal'}
                onChange={onReviewModeChange}
              />
            )}
            <Button variant="ghost" size="sm" onClick={onEditProject}>
              {translate('portfolio.editProject', 'Edit initiative')}
            </Button>
            {view === 'tasks' && tasks.length > 0 && roles.length > 0 && (
              <Button size="sm" onClick={onCreateTask}>
                <Plus aria-hidden="true" />
                {translate('portfolio.newTask', 'New task')}
              </Button>
            )}
          </div>
        </div>
        <details className="group">
          <summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {translate(
              'portfolio.projectContextSummary',
              'Initiative context · {{count}} sources',
              {
                count: project.repoIds.length
              }
            )}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {project.objective}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {project.repoIds.map((id) => (
                <Badge
                  key={id}
                  variant="outline"
                  className="max-w-full whitespace-normal break-all"
                >
                  {repos.find((repo) => repo.id === id)?.name ??
                    translate('portfolio.unavailableRepository', 'Unavailable repository')}
                </Badge>
              ))}
            </div>
          </div>
        </details>
      </header>
      {(outcomeContent || featureContent || notesContent) && (
        <div
          className="mb-5 flex gap-2"
          role="group"
          aria-label={translate('portfolio.projectViews', 'Initiative views')}
        >
          {[
            ...(outcomeContent
              ? [{ id: 'outcomes', name: translate('portfolio.outcomes', 'Outcomes') }]
              : []),
            ...(featureContent
              ? [{ id: 'features', name: translate('portfolio.features', 'Features') }]
              : []),
            { id: 'tasks', name: translate('portfolio.tasks', 'Tasks') },
            ...(notesContent ? [{ id: 'notes', name: translate('portfolio.notes', 'Notes') }] : [])
          ].map((entry) => (
            <Button
              key={entry.id}
              variant={view === entry.id ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={view === entry.id}
              onClick={() => setView(entry.id)}
            >
              {entry.name}
            </Button>
          ))}
        </div>
      )}
      {outcomeContent && <div hidden={view !== 'outcomes'}>{outcomeContent}</div>}
      {featureContent && <div hidden={view !== 'features'}>{featureContent}</div>}
      {view === 'notes' && notesContent}
      {view === 'tasks' &&
        (tasks.length > 0 ? (
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
                aria-label={translate('portfolio.projectProgress', 'Initiative completion')}
                className="h-1"
              />
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.acceptanceHint',
                  'Progress advances when you review and accept a result.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {translate(
                  'portfolio.tasksInTasksPage',
                  'Start, follow, and review this initiative’s {{count}} tasks in Tasks.',
                  {
                    count: tasks.length,
                    defaultValue_one:
                      'Start, follow, and review this initiative’s {{count}} task in Tasks.'
                  }
                )}
              </p>
              <Button variant="outline" size="sm" onClick={onOpenTasks}>
                <SquareArrowOutUpRight aria-hidden="true" />
                {translate('portfolio.openInTasks', 'Open in Tasks')}
              </Button>
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
                      'Choose an agent and define its responsibility. Then you can assign tasks in this initiative.'
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
        ))}
    </main>
  )
}

// Personal: the agents review and test. Team: they also triage the PR's review and external QA.
function ReviewModeSwitch({
  mode,
  onChange
}: {
  mode: PortfolioReviewMode
  onChange: (mode: PortfolioReviewMode) => void
}): React.JSX.Element {
  const options: { id: PortfolioReviewMode; name: string; hint: string }[] = [
    {
      id: 'personal',
      name: translate('portfolio.reviewPersonalShort', 'Personal'),
      hint: translate('portfolio.reviewPersonal', 'Personal: agents only')
    },
    {
      id: 'team',
      name: translate('portfolio.reviewTeamShort', 'Team'),
      hint: translate(
        'portfolio.reviewModeHint',
        'In a team initiative, code review and QA agents also triage the PR’s comments and the outcome’s QA feedback, and work is done when its PR merges.'
      )
    }
  ]
  return (
    <div
      role="group"
      aria-label={translate('portfolio.reviewMode', 'Review and QA')}
      className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs"
    >
      <span className="px-1.5 text-muted-foreground">
        {translate('portfolio.reviewMode', 'Review and QA')}
      </span>
      {options.map((option) => (
        <Button
          key={option.id}
          variant={mode === option.id ? 'secondary' : 'ghost'}
          size="xs"
          aria-pressed={mode === option.id}
          title={option.hint}
          onClick={() => mode !== option.id && onChange(option.id)}
        >
          {option.name}
        </Button>
      ))}
    </div>
  )
}
