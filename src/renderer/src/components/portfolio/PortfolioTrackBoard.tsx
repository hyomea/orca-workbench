import { CircleAlert, CircleCheck, Gavel, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabelById } from '../../../../shared/portfolio-roles'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import { workPlatformName } from './portfolio-feature-labels'
import { attentionLabel, stageName } from './portfolio-track-labels'
import { PORTFOLIO_STAGES, type PortfolioTrack, type PortfolioTrackCell } from './portfolio-tracks'

const GRID = 'grid grid-cols-[minmax(12rem,1.4fr)_repeat(3,minmax(9rem,1fr))_minmax(6rem,0.6fr)]'

function cellStatus(track: PortfolioTrack, stage: PortfolioTaskStage, cell: PortfolioTrackCell) {
  const position = PORTFOLIO_STAGES.indexOf(stage)
  const current =
    track.current === 'done' || track.current === 'external'
      ? PORTFOLIO_STAGES.length
      : PORTFOLIO_STAGES.indexOf(track.current)
  if (position > current) {
    return { text: translate('portfolio.trackWaiting', 'Waiting'), tone: 'muted' as const }
  }
  if (position < current) {
    return cell.task.status === 'accepted'
      ? { text: translate('portfolio.trackAccepted', 'Accepted'), tone: 'done' as const }
      : { text: translate('portfolio.trackSubmitted', 'Submitted'), tone: 'done' as const }
  }
  if (track.next === 'decide') {
    return { text: translate('portfolio.trackDecide', 'Needs your decision'), tone: 'you' as const }
  }
  if (cell.attention) {
    return { text: attentionLabel(cell.attention), tone: 'alert' as const }
  }
  if (track.next === 'start') {
    return { text: translate('portfolio.trackStart', 'Ready to start'), tone: 'you' as const }
  }
  return { text: translate('portfolio.trackWorking', 'Agent working'), tone: 'agent' as const }
}

function TrackCell({
  state,
  track,
  stage,
  onSelectTask
}: {
  state: PortfolioState
  track: PortfolioTrack
  stage: PortfolioTaskStage
  onSelectTask: (taskId: string) => void
}): React.JSX.Element {
  const cell = track.cells[stage]
  const isCurrent = track.current === stage
  if (!cell) {
    const external = track.current === 'external' && stage === 'development'
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground',
          isCurrent && 'border-foreground/40 text-foreground'
        )}
      >
        {external
          ? translate('portfolio.trackExternal', 'Tracked on {{ticket}}', { ticket: track.ticket })
          : translate('portfolio.trackNotPlanned', 'Not planned')}
      </div>
    )
  }
  const status = cellStatus(track, stage, cell)
  const steps = cell.task.steps
  return (
    <button
      type="button"
      aria-label={`${stageName(stage)}: ${cell.task.title}`}
      onClick={() => onSelectTask(cell.task.id)}
      className={cn(
        'w-full space-y-1 rounded-md border border-border bg-card p-2 text-left text-xs shadow-xs outline-none hover:border-muted-foreground/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        isCurrent && 'border-foreground/40'
      )}
    >
      <span className="block truncate font-medium">
        {portfolioRoleLabelById(state, cell.task.roleId)}
      </span>
      <span
        className={cn(
          'flex items-center gap-1',
          status.tone === 'muted' && 'text-muted-foreground',
          status.tone === 'done' && 'text-muted-foreground',
          status.tone === 'alert' && 'text-destructive',
          status.tone === 'you' && 'font-medium'
        )}
      >
        {status.tone === 'done' && <CircleCheck className="size-3" aria-hidden="true" />}
        {status.tone === 'agent' && (
          <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        )}
        {status.text}
      </span>
      {stage === 'development' && steps.length > 0 && (
        <span className="block text-muted-foreground">
          {translate('portfolio.trackSteps', 'Steps {{done}}/{{total}}', {
            done: steps.filter((step) => step.done).length,
            total: steps.length
          })}
        </span>
      )}
      {isCurrent && status.tone === 'agent' && cell.observation?.lastAssistantMessage && (
        <span className="line-clamp-2 block text-muted-foreground">
          {cell.observation.lastAssistantMessage}
        </span>
      )}
    </button>
  )
}

function TrackRow({
  state,
  track,
  showProject,
  onSelectTask
}: {
  state: PortfolioState
  track: PortfolioTrack
  showProject: boolean
  onSelectTask: (taskId: string) => void
}): React.JSX.Element {
  const project = showProject
    ? state.projects.find((entry) => entry.id === track.projectId)?.name
    : undefined
  return (
    <div role="row" className={cn(GRID, 'items-start gap-2 border-t border-border/50 py-2')}>
      <div role="rowheader" className="min-w-0 space-y-0.5 text-sm">
        <span className="block break-words font-medium">{track.title}</span>
        <span className="block text-xs text-muted-foreground">
          {[track.platform ? workPlatformName(track.platform) : undefined, track.ticket, project]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {PORTFOLIO_STAGES.map((stage) => (
        <div role="cell" key={stage} className="min-w-0">
          <TrackCell state={state} track={track} stage={stage} onSelectTask={onSelectTask} />
        </div>
      ))}
      <div role="cell" className="pt-2 text-xs text-muted-foreground">
        {track.current === 'done' && (
          <span className="flex items-center gap-1">
            <CircleCheck className="size-3" aria-hidden="true" />
            {translate('portfolio.trackDone', 'Done')}
          </span>
        )}
      </div>
    </div>
  )
}

// Each outcome platform as a pipeline: development, code review, QA, done.
export function PortfolioTrackBoard({
  state,
  tracks,
  showProject,
  onSelectTask
}: {
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  showProject: boolean
  onSelectTask: (taskId: string) => void
}): React.JSX.Element {
  const open = tracks.filter((track) => track.current !== 'done')
  const done = tracks.filter((track) => track.current === 'done')
  const count = (...next: PortfolioTrack['next'][]) =>
    open.filter((track) => next.includes(track.next)).length
  const summary = [
    {
      icon: Gavel,
      text: translate('portfolio.summaryYou', 'Needs you: {{count}}', {
        count: count('decide', 'start', 'plan'),
        defaultValue_one: 'Needs you: {{count}}'
      })
    },
    {
      icon: CircleAlert,
      text: translate('portfolio.summaryAttention', 'Needs attention: {{count}}', {
        count: count('attention'),
        defaultValue_one: 'Needs attention: {{count}}'
      })
    },
    {
      icon: LoaderCircle,
      text: translate('portfolio.summaryAgents', 'Agents working: {{count}}', {
        count: count('agent'),
        defaultValue_one: 'Agents working: {{count}}'
      })
    }
  ]
  const header = (
    <div role="row" className={cn(GRID, 'gap-2 pb-1 text-xs font-medium text-muted-foreground')}>
      <span role="columnheader">{translate('portfolio.trackColumn', 'Outcome · platform')}</span>
      {PORTFOLIO_STAGES.map((stage) => (
        <span role="columnheader" key={stage}>
          {stageName(stage)}
        </span>
      ))}
      <span role="columnheader">{translate('portfolio.trackDone', 'Done')}</span>
    </div>
  )
  const rows = (list: readonly PortfolioTrack[]) =>
    list.map((track) => (
      <TrackRow
        key={track.key}
        state={state}
        track={track}
        showProject={showProject}
        onSelectTask={onSelectTask}
      />
    ))
  return (
    <div className="space-y-3">
      <ul
        aria-label={translate('portfolio.trackSummary', 'Summary')}
        className="flex flex-wrap gap-2"
      >
        {summary.map((entry) => (
          <li
            key={entry.text}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs"
          >
            <entry.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {entry.text}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto scrollbar-sleek">
        <div role="table" className="min-w-[48rem]">
          {header}
          {rows(open)}
          {open.length === 0 && (
            <p className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
              {translate(
                'portfolio.noOpenTracks',
                'Nothing in progress. Plan outcomes and their tasks in Workbench.'
              )}
            </p>
          )}
        </div>
      </div>
      {done.length > 0 && (
        <details className="rounded-md border border-border/50 p-2">
          <summary className="flex cursor-pointer items-center gap-2 px-1 text-xs font-medium">
            <CircleCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {translate('portfolio.doneCount', 'Done ({{count}})', {
              count: done.length,
              defaultValue_one: 'Done ({{count}})'
            })}
          </summary>
          <div className="mt-2 overflow-x-auto scrollbar-sleek">
            <div role="table" className="min-w-[48rem]">
              {header}
              {rows(done)}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
