import { useState } from 'react'
import { ChevronDown, ChevronRight, GitPullRequest } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabelById } from '../../../../shared/portfolio-roles'
import { workPlatformName } from './portfolio-feature-labels'
import { stageName } from './portfolio-track-labels'
import { prStatusLabel } from './portfolio-track-pr'
import {
  portfolioTrackCellStatus,
  portfolioTrackCurrentStage,
  type PortfolioTrackCellStatus
} from './portfolio-track-status'
import {
  PORTFOLIO_FOLDED_SECTIONS,
  portfolioListSections,
  type PortfolioTrackSectionKey
} from './portfolio-track-view'
import { portfolioTicketLabel, type PortfolioTrack } from './portfolio-tracks'
import { PortfolioTrackPin } from './PortfolioTrackPin'

const GRID =
  'grid grid-cols-[6rem_minmax(12rem,1fr)_8rem_minmax(9rem,0.6fr)_minmax(9rem,0.6fr)_minmax(8rem,0.5fr)_1.5rem] items-center gap-3'

function sectionLabel(key: PortfolioTrackSectionKey): string {
  switch (key) {
    case 'pinned':
      return translate('portfolio.listPinned', 'Pinned')
    case 'development':
    case 'codeReview':
    case 'qa':
      return stageName(key)
    case 'merge':
      return translate('portfolio.phaseMerge', 'Waiting to merge')
    case 'external':
      return translate('portfolio.listTracked', 'Tracked elsewhere')
    case 'notStarted':
      return translate('portfolio.listNotStarted', 'Not started')
    case 'done':
      return translate('portfolio.trackDone', 'Done')
  }
}

// One line per ticket: the stage it is at, who acts next, and who works on it.
function rowStatus(track: PortfolioTrack): PortfolioTrackCellStatus {
  const stage = portfolioTrackCurrentStage(track)
  const cell = stage && track.cells[stage]
  if (stage && cell) {
    return portfolioTrackCellStatus(track, stage, cell)
  }
  switch (track.current) {
    case 'done':
      return { text: translate('portfolio.trackDone', 'Done'), tone: 'done' }
    case 'external':
      return { text: translate('portfolio.trackTracked', 'Tracked'), tone: 'muted' }
    default:
      return { text: translate('portfolio.trackNotPlanned', 'Not planned'), tone: 'you' }
  }
}

function TrackLine({
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
  const stage = portfolioTrackCurrentStage(track)
  const cell = (stage && track.cells[stage]) || Object.values(track.cells)[0]
  const status = rowStatus(track)
  const ticket = track.ticket ? portfolioTicketLabel(track.ticket) : ''
  const platform = track.platform ? workPlatformName(track.platform) : ''
  return (
    <div
      role="row"
      tabIndex={cell ? 0 : -1}
      onClick={() => cell && onSelectTask(cell.task.id)}
      onKeyDown={(event) => {
        if (
          cell &&
          (event.key === 'Enter' || event.key === ' ') &&
          event.target === event.currentTarget
        ) {
          event.preventDefault()
          onSelectTask(cell.task.id)
        }
      }}
      className={cn(
        GRID,
        'group/track min-h-11 border-t border-border/40 px-3 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
        cell && 'cursor-pointer hover:bg-accent'
      )}
    >
      <span role="cell" className="truncate font-mono text-muted-foreground" title={track.ticket}>
        {ticket}
      </span>
      <span role="cell" className="min-w-0">
        <span className="block truncate text-[13px]">{track.title}</span>
        {platform && <span className="text-muted-foreground">{platform}</span>}
      </span>
      <span role="cell" className="text-muted-foreground">
        {stage ? stageName(stage) : ''}
      </span>
      <span
        role="cell"
        className={cn(
          status.tone === 'alert' && 'text-destructive',
          status.tone === 'you' && 'font-medium',
          (status.tone === 'muted' || status.tone === 'done') && 'text-muted-foreground'
        )}
      >
        {status.text}
      </span>
      <span role="cell" className="truncate text-muted-foreground">
        {cell && track.current !== 'done' ? portfolioRoleLabelById(state, cell.task.roleId) : ''}
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-1 text-muted-foreground">
        {track.pr?.number !== undefined && (
          <>
            <GitPullRequest className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{`#${track.pr.number} · ${prStatusLabel(track.pr.status)}`}</span>
          </>
        )}
      </span>
      <span role="cell">
        <PortfolioTrackPin
          pinned={pinned}
          label={ticket || track.title}
          onToggle={() => onTogglePin(track.key)}
        />
      </span>
    </div>
  )
}

// Tickets grouped by stage, like a tracker's status groups. What nobody started and finished
// work start folded; the user's choices hold while the page is open.
export function PortfolioTrackList({
  state,
  tracks,
  pinned,
  foldNotStarted,
  onTogglePin,
  onSelectTask
}: {
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  pinned: ReadonlySet<string>
  foldNotStarted: boolean
  onTogglePin: (trackKey: string) => void
  onSelectTask: (taskId: string) => void
}): React.JSX.Element {
  const [toggled, setToggled] = useState<ReadonlySet<PortfolioTrackSectionKey>>(() => new Set())
  const sections = portfolioListSections(tracks, pinned, foldNotStarted)
  if (!sections.length) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {translate('portfolio.noMatchingTracks', 'No tickets match these filters.')}
      </p>
    )
  }
  return (
    <div
      role="table"
      className="overflow-x-auto rounded-md border border-border/50 scrollbar-sleek"
    >
      <div className="min-w-[56rem]">
        <div
          role="row"
          className={cn(GRID, 'px-3 py-2 text-[11px] font-medium uppercase text-muted-foreground')}
        >
          <span role="columnheader">{translate('portfolio.listKey', 'Key')}</span>
          <span role="columnheader">{translate('portfolio.listOutcome', 'Outcome')}</span>
          <span role="columnheader">{translate('portfolio.listStage', 'Stage')}</span>
          <span role="columnheader">{translate('portfolio.listStatus', 'Status')}</span>
          <span role="columnheader">{translate('portfolio.listAgent', 'Agent')}</span>
          <span role="columnheader">{translate('portfolio.listPr', 'PR')}</span>
          <span role="columnheader" />
        </div>
        {sections.map((section) => {
          const open = PORTFOLIO_FOLDED_SECTIONS.has(section.key) === toggled.has(section.key)
          return (
            <Collapsible
              key={section.key}
              open={open}
              onOpenChange={() =>
                setToggled((current) => {
                  const next = new Set(current)
                  if (!next.delete(section.key)) {
                    next.add(section.key)
                  }
                  return next
                })
              }
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-full justify-start rounded-none border-t border-border/50 bg-muted/35 px-3 text-left font-normal hover:bg-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {open ? (
                    <ChevronDown className="size-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 text-muted-foreground" />
                  )}
                  <span className="text-[13px] font-medium">{sectionLabel(section.key)}</span>
                  <span className="text-[11px] text-muted-foreground">{section.tracks.length}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent role="rowgroup" aria-label={sectionLabel(section.key)}>
                {section.tracks.map((track) => (
                  <TrackLine
                    key={track.key}
                    state={state}
                    track={track}
                    pinned={pinned.has(track.key)}
                    onTogglePin={onTogglePin}
                    onSelectTask={onSelectTask}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </div>
  )
}
