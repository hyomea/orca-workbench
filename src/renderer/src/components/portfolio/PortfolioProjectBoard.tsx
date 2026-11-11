import type { ReactNode } from 'react'
import { BookOpenText, Bot, Check, ChevronDown, Layers, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioReviewMode } from '../../../../shared/portfolio-task-stages'

// An initiative's outcomes, with its context, agents, and feature catalog a click away. The
// sidebar already names the workbench, so the initiative's title leads the page and switches it.
export function PortfolioProjectBoard({
  project,
  projects,
  actions,
  onSelectProject,
  onCreateProject,
  roleCount,
  onEditProject,
  onOpenContext,
  noteProposals = 0,
  onOpenAgents,
  onOpenFeatures,
  onReviewModeChange,
  hideHeader = false,
  children
}: {
  project: PortfolioState['projects'][number]
  projects: PortfolioState['projects']
  // The workbench's own actions (its coordinator and menu), on the same line as the title.
  actions?: ReactNode
  onSelectProject?: (id: string) => void
  onCreateProject?: () => void
  roleCount: number
  onEditProject: () => void
  onOpenContext: () => void
  // Agents' note proposals waiting for the user, counted on the button that leads to them.
  noteProposals?: number
  onOpenAgents: () => void
  onOpenFeatures: () => void
  onReviewModeChange?: (mode: PortfolioReviewMode) => void
  // An open outcome has its own heading and a way back; the initiative's header would crowd it.
  hideHeader?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <main className="@container/project min-h-0 min-w-0 p-5 @3xl/portfolio:p-6">
      {!hideHeader && (
        <header className="mb-5 space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="-ml-2 h-auto max-w-full px-2 py-1 text-lg font-semibold"
                    aria-label={translate('portfolio.switchInitiative', 'Switch initiative')}
                  >
                    <h2 className="min-w-0 truncate">{project.name}</h2>
                    <ChevronDown className="text-muted-foreground" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {projects.map((entry) => (
                    <DropdownMenuItem key={entry.id} onSelect={() => onSelectProject?.(entry.id)}>
                      <Check
                        aria-hidden="true"
                        className={entry.id === project.id ? undefined : 'invisible'}
                      />
                      {entry.name}
                    </DropdownMenuItem>
                  ))}
                  {onCreateProject && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={onCreateProject}>
                        <Plus aria-hidden="true" />
                        {translate('portfolio.newProject', 'New initiative')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.purpose',
                  'Define outcomes and sign them off. Run and review the work in Tasks.'
                )}
              </p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label={translate('portfolio.initiativeReference', 'Initiative setup')}
              className="flex flex-wrap gap-2"
            >
              <Button variant="outline" size="sm" onClick={onOpenContext}>
                <BookOpenText aria-hidden="true" />
                {translate('portfolio.contextAndNotes', 'Context & notes')}
                {noteProposals > 0 && (
                  <Badge className="ml-1">
                    {translate('portfolio.toReviewCount', '{{count}} to review', {
                      count: noteProposals,
                      defaultValue_one: '{{count}} to review'
                    })}
                  </Badge>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenAgents}>
                <Bot aria-hidden="true" />
                {translate('portfolio.agentsCount', 'Agents · {{count}}', {
                  count: roleCount,
                  defaultValue_one: 'Agents · {{count}}'
                })}
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenFeatures}>
                <Layers aria-hidden="true" />
                {translate('portfolio.featureCatalog', 'Feature catalog')}
              </Button>
            </div>
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
            </div>
          </div>
        </header>
      )}
      {children}
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
