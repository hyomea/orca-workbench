import { CircleCheck, GitPullRequest, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabelById } from '../../../../shared/portfolio-roles'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import { ticketRoleName, workPlatformName } from './portfolio-feature-labels'
import { stageName } from './portfolio-track-labels'
import { portfolioTrackCellStatus } from './portfolio-track-status'
import { portfolioBoardSections } from './portfolio-track-view'
import { PortfolioPin } from './PortfolioPin'
import { prStatusLabel, type PortfolioTrackPr } from './portfolio-track-pr'
import {
  PORTFOLIO_STAGES,
  portfolioTicketLabel,
  type PortfolioTrack,
  type PortfolioTrackGroup
} from './portfolio-tracks'

const GRID = 'grid grid-cols-[minmax(9rem,0.9fr)_repeat(3,minmax(9rem,1fr))_minmax(8rem,0.7fr)]'

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
  // Team work waiting on its PR stays with code review, where the team's review happens.
  const isCurrent =
    track.current === stage ||
    (stage === 'codeReview' && track.current === 'merge' && Boolean(cell))
  if (!cell) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground',
          isCurrent && 'border-foreground/40 text-foreground'
        )}
      >
        {emptyCellText(track, stage)}
      </div>
    )
  }
  const status = portfolioTrackCellStatus(track, stage, cell)
  const steps = cell.task.steps
  return (
    <button
      type="button"
      aria-label={`${stageName(stage)}: ${cell.task.title}`}
      onClick={() => onSelectTask(cell.task.id)}
      className={cn(
        'w-full space-y-1 rounded-md border border-border bg-card p-2 text-left text-xs shadow-xs outline-none hover:border-muted-foreground/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        isCurrent && 'border-foreground/40',
        status.tone === 'muted' && 'border-dashed border-border/60 bg-transparent shadow-none'
      )}
    >
      <span
        className={cn(
          'block truncate',
          status.tone === 'muted' ? 'text-muted-foreground' : 'font-medium'
        )}
      >
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
      {stage === 'codeReview' && track.pr && <PrLine pr={track.pr} />}
      {stage === 'codeReview' && track.newCommits && (
        <span className="block font-medium">
          {translate('portfolio.trackNewCommits', 'New commits since your review')}
        </span>
      )}
      {stage === 'development' && steps.length > 0 && (
        <span className="block text-muted-foreground">
          {translate('portfolio.trackSteps', 'Steps {{done}}/{{total}}', {
            done: steps.filter((step) => step.done).length,
            total: steps.length
          })}
        </span>
      )}
      {isCurrent && status.tone === 'agent' && cell.observation?.lastAssistantMessage && (
        // line-clamp sets its own display, so the span must not also be `block`.
        <span className="line-clamp-2 break-words text-muted-foreground">
          {/* A preview only: Markdown markers would read as noise in two lines. */}
          {cell.observation.lastAssistantMessage.replace(/[*`#]/g, '')}
        </span>
      )}
    </button>
  )
}

function emptyCellText(track: PortfolioTrack, stage: PortfolioTaskStage): string {
  if (stage === 'development' && track.current === 'external') {
    return track.ticket
      ? translate('portfolio.trackExternal', 'Tracked on {{ticket}}', {
          ticket: portfolioTicketLabel(track.ticket)
        })
      : translate('portfolio.trackExternalPr', 'Tracked on its PR')
  }
  if (stage === 'development' && track.role === 'reviewer') {
    return translate('portfolio.trackTeammate', 'Built by a teammate')
  }
  return translate('portfolio.trackNotPlanned', 'Not planned')
}

// A team initiative's PR, shown with code review until it merges.
function PrLine({ pr }: { pr: PortfolioTrackPr }): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex items-center gap-1',
        (pr.status === 'merged' || pr.status === 'checking') && 'text-muted-foreground',
        (pr.status === 'ciFailing' || pr.status === 'closed') && 'text-destructive'
      )}
    >
      <GitPullRequest className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {pr.number ? `#${pr.number} · ${prStatusLabel(pr.status)}` : prStatusLabel(pr.status)}
      </span>
    </span>
  )
}

function DoneCell({
  track,
  onSelectTask
}: {
  track: PortfolioTrack
  onSelectTask: (taskId: string) => void
}): React.JSX.Element | null {
  // Only a track without a code review task shows its PR here.
  const review = track.cells.codeReview ? undefined : track.cells.development?.task
  if (track.current === 'merge' && track.pr && review) {
    return (
      <button
        type="button"
        aria-label={`${translate('portfolio.trackMerge', 'Merge')}: ${review.title}`}
        onClick={() => onSelectTask(review.id)}
        className="w-full rounded-md border border-foreground/40 bg-card p-2 text-left text-xs shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PrLine pr={track.pr} />
      </button>
    )
  }
  if (track.current !== 'done') {
    return null
  }
  return (
    <span className="flex items-center gap-1 pt-2 text-xs text-muted-foreground">
      <CircleCheck className="size-3" aria-hidden="true" />
      {track.pr?.status === 'merged'
        ? translate('portfolio.prMerged', 'Merged')
        : translate('portfolio.trackDone', 'Done')}
    </span>
  )
}

function TrackRow({
  state,
  track,
  pinned,
  onTogglePin,
  onSelectTask
}: {
  state: PortfolioState
  track: PortfolioTrack
  pinned: boolean
  onTogglePin: (trackKey: string) => void
  onSelectTask: (taskId: string) => void
}): React.JSX.Element {
  const platform = track.platform
    ? workPlatformName(track.platform)
    : track.item
      ? translate('portfolio.trackNoPlatform', 'No platform')
      : translate('portfolio.trackNoOutcome', 'Task without an outcome')
  return (
    <div role="row" className={cn(GRID, 'group/pin items-start gap-2 py-1 pl-3')}>
      <div role="rowheader" className="flex min-w-0 items-start gap-1 pt-2 text-xs">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{platform}</span>
          {track.ticket && (
            <span className="ml-1.5 text-muted-foreground" title={track.ticket}>
              {portfolioTicketLabel(track.ticket)}
            </span>
          )}
          {track.role !== 'author' && (
            <span className="block text-muted-foreground">{ticketRoleName(track.role)}</span>
          )}
        </span>
        <PortfolioPin
          pinned={pinned}
          label={track.ticket ? portfolioTicketLabel(track.ticket) : platform}
          onToggle={() => onTogglePin(track.key)}
        />
      </div>
      {PORTFOLIO_STAGES.map((stage) => (
        <div role="cell" key={stage} className="min-w-0">
          <TrackCell state={state} track={track} stage={stage} onSelectTask={onSelectTask} />
        </div>
      ))}
      <div role="cell" className="min-w-0">
        <DoneCell track={track} onSelectTask={onSelectTask} />
      </div>
    </div>
  )
}

type RowProps = {
  state: PortfolioState
  showProject: boolean
  pinned: ReadonlySet<string>
  onTogglePin: (trackKey: string) => void
  onSelectTask: (taskId: string) => void
}

function TrackGroup({
  group,
  ...props
}: RowProps & { group: PortfolioTrackGroup }): React.JSX.Element {
  const project = props.showProject
    ? props.state.projects.find((entry) => entry.id === group.projectId)?.name
    : undefined
  return (
    <div role="rowgroup" aria-label={group.title} className="border-t border-border/50 py-2">
      <div role="row" className="flex flex-wrap items-baseline gap-x-2 px-0 pb-1">
        <span role="rowheader" className="break-words text-sm font-medium">
          {group.title}
        </span>
        {project && <span className="text-xs text-muted-foreground">{project}</span>}
      </div>
      {group.tracks.map((track) => (
        <TrackRow
          key={track.key}
          state={props.state}
          track={track}
          pinned={props.pinned.has(track.key)}
          onTogglePin={props.onTogglePin}
          onSelectTask={props.onSelectTask}
        />
      ))}
    </div>
  )
}

function Header(): React.JSX.Element {
  return (
    <div role="row" className={cn(GRID, 'gap-2 pb-1 text-xs font-medium text-muted-foreground')}>
      <span role="columnheader">{translate('portfolio.trackColumn', 'Outcome / ticket')}</span>
      {PORTFOLIO_STAGES.map((stage) => (
        <span role="columnheader" key={stage}>
          {stageName(stage)}
        </span>
      ))}
      <span role="columnheader">{translate('portfolio.trackDone', 'Done')}</span>
    </div>
  )
}

function Folded({
  label,
  groups,
  ...props
}: RowProps & { label: string; groups: PortfolioTrackGroup[] }): React.JSX.Element | null {
  if (!groups.length) {
    return null
  }
  return (
    <details className="rounded-md border border-border/50 p-2">
      <summary className="cursor-pointer px-1 text-xs font-medium">{label}</summary>
      <div className="mt-2 overflow-x-auto scrollbar-sleek">
        <div role="table" className="min-w-[48rem]">
          <Header />
          {groups.map((group) => (
            <TrackGroup key={group.key} group={group} {...props} />
          ))}
        </div>
      </div>
    </details>
  )
}

// Each outcome platform as a pipeline: development, code review, QA, done (merged, for a team).
// Pinned tickets come first; outcomes nobody started and finished work fold away.
export function PortfolioTrackBoard({
  tracks,
  foldNotStarted,
  ...props
}: RowProps & {
  tracks: readonly PortfolioTrack[]
  foldNotStarted: boolean
}): React.JSX.Element {
  const sections = portfolioBoardSections(tracks, props.pinned, foldNotStarted)
  const active = [...sections.pinned, ...sections.open]
  const count = (list: PortfolioTrackGroup[]) =>
    list.reduce((total, group) => total + group.tracks.length, 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto scrollbar-sleek">
        <div role="table" className="min-w-[48rem]">
          <Header />
          {active.map((group, index) => (
            <TrackGroup
              key={`${index < sections.pinned.length}:${group.key}`}
              group={group}
              {...props}
            />
          ))}
          {active.length === 0 && (
            <p className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
              {translate(
                'portfolio.noOpenTracks',
                'Nothing in progress. Plan outcomes and their tasks in Workbench.'
              )}
            </p>
          )}
        </div>
      </div>
      <Folded
        label={translate('portfolio.notStartedCount', 'Not started ({{count}})', {
          count: count(sections.notStarted),
          defaultValue_one: 'Not started ({{count}})'
        })}
        groups={sections.notStarted}
        {...props}
      />
      <Folded
        label={translate('portfolio.doneCount', 'Done ({{count}})', {
          count: count(sections.done),
          defaultValue_one: 'Done ({{count}})'
        })}
        groups={sections.done}
        {...props}
      />
    </div>
  )
}
