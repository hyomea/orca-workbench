import type { PortfolioWorkPlatform } from '../../../../shared/portfolio-features'
import {
  portfolioTrackGroups,
  type PortfolioTrack,
  type PortfolioTrackGroup,
  type PortfolioTrackNext
} from './portfolio-tracks'

// The summary counts double as filters: who moves each track forward.
export type PortfolioTrackFilter = 'you' | 'attention' | 'agent' | 'waiting'

export const PORTFOLIO_TRACK_FILTER_NEXT: Record<
  PortfolioTrackFilter,
  readonly PortfolioTrackNext[]
> = {
  you: ['decide', 'start', 'plan'],
  attention: ['attention'],
  agent: ['agent'],
  waiting: ['waiting']
}

export type PortfolioTrackSectionKey = 'pinned' | PortfolioTrack['current'] | 'notStarted'

// Stage order for the list; what nobody started and finished work come last, folded away.
export const PORTFOLIO_LIST_SECTIONS: readonly PortfolioTrackSectionKey[] = [
  'pinned',
  'development',
  'codeReview',
  'qa',
  'merge',
  'external',
  'notStarted',
  'done'
]

export const PORTFOLIO_FOLDED_SECTIONS: ReadonlySet<PortfolioTrackSectionKey> = new Set([
  'notStarted',
  'done'
])

export function filterPortfolioTracks(
  tracks: readonly PortfolioTrack[],
  filter: PortfolioTrackFilter | null,
  platform: PortfolioWorkPlatform | null
): PortfolioTrack[] {
  return tracks.filter(
    (track) =>
      (!platform || track.platform === platform) &&
      (!filter ||
        (track.current !== 'done' && PORTFOLIO_TRACK_FILTER_NEXT[filter].includes(track.next)))
  )
}

// Work began on a track once any of its tasks ran or moved on from planned.
export function portfolioTrackStarted(track: PortfolioTrack): boolean {
  return Object.values(track.cells).some(
    (cell) => cell.task.attempts.length > 0 || cell.task.status !== 'todo'
  )
}

function sectionOf(
  track: PortfolioTrack,
  pinned: ReadonlySet<string>,
  foldNotStarted: boolean
): PortfolioTrackSectionKey {
  if (pinned.has(track.key) && track.current !== 'done') {
    return 'pinned'
  }
  if (
    foldNotStarted &&
    track.current !== 'external' &&
    track.current !== 'done' &&
    !portfolioTrackStarted(track)
  ) {
    return 'notStarted'
  }
  return track.current
}

// One list group per stage, in pipeline order. A filter already narrows the rows, so nothing it
// matched is folded away as not started.
export function portfolioListSections(
  tracks: readonly PortfolioTrack[],
  pinned: ReadonlySet<string>,
  foldNotStarted: boolean
): { key: PortfolioTrackSectionKey; tracks: PortfolioTrack[] }[] {
  return PORTFOLIO_LIST_SECTIONS.map((key) => ({
    key,
    tracks: tracks.filter((track) => sectionOf(track, pinned, foldNotStarted) === key)
  })).filter((section) => section.tracks.length > 0)
}

// The board keeps outcomes together: pinned tickets first, then outcomes in progress; those
// nobody started and finished work fold away.
export function portfolioBoardSections(
  tracks: readonly PortfolioTrack[],
  pinned: ReadonlySet<string>,
  foldNotStarted: boolean
): Record<'pinned' | 'open' | 'notStarted' | 'done', PortfolioTrackGroup[]> {
  const pick = (keys: readonly PortfolioTrackSectionKey[]) =>
    portfolioTrackGroups(
      tracks.filter((track) => keys.includes(sectionOf(track, pinned, foldNotStarted)))
    )
  return {
    pinned: pick(['pinned']),
    open: pick(['development', 'codeReview', 'qa', 'merge', 'external']),
    notStarted: pick(['notStarted']),
    done: pick(['done'])
  }
}
