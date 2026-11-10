import { CircleAlert, Gavel, GitPullRequest, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { PortfolioWorkPlatform } from '../../../../shared/portfolio-features'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { workPlatformName } from './portfolio-feature-labels'
import { PORTFOLIO_TRACK_FILTER_NEXT, type PortfolioTrackFilter } from './portfolio-track-view'
import type { PortfolioTrack } from './portfolio-tracks'

const ALL_PLATFORMS = 'all'

function filterLabel(filter: PortfolioTrackFilter, count: number): string {
  switch (filter) {
    case 'you':
      return translate('portfolio.summaryYou', 'Needs you: {{count}}', {
        count,
        defaultValue_one: 'Needs you: {{count}}'
      })
    case 'attention':
      return translate('portfolio.summaryAttention', 'Needs attention: {{count}}', {
        count,
        defaultValue_one: 'Needs attention: {{count}}'
      })
    case 'agent':
      return translate('portfolio.summaryAgents', 'Agents working: {{count}}', {
        count,
        defaultValue_one: 'Agents working: {{count}}'
      })
    case 'waiting':
      return translate('portfolio.summaryPrs', 'PRs in review: {{count}}', {
        count,
        defaultValue_one: 'PRs in review: {{count}}'
      })
  }
}

const ICONS = { you: Gavel, attention: CircleAlert, agent: LoaderCircle, waiting: GitPullRequest }

// Who acts next, counted over the open tracks; choosing a count shows only those tracks.
export function PortfolioTrackFilters({
  tracks,
  filter,
  platform,
  onFilterChange,
  onPlatformChange
}: {
  tracks: readonly PortfolioTrack[]
  filter: PortfolioTrackFilter | null
  platform: PortfolioWorkPlatform | null
  onFilterChange: (filter: PortfolioTrackFilter | null) => void
  onPlatformChange: (platform: PortfolioWorkPlatform | null) => void
}): React.JSX.Element {
  const open = tracks.filter(
    (track) => track.current !== 'done' && (!platform || track.platform === platform)
  )
  const platforms = [
    ...new Set(tracks.flatMap((track) => (track.platform ? [track.platform] : [])))
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={translate('portfolio.trackSummary', 'Summary')} className="contents">
        {(Object.keys(PORTFOLIO_TRACK_FILTER_NEXT) as PortfolioTrackFilter[]).map((entry) => {
          const Icon = ICONS[entry]
          const active = filter === entry
          return (
            <li key={entry}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(active ? null : entry)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-foreground/40 bg-accent font-medium'
                    : 'border-border/60 bg-muted/50 hover:bg-accent'
                )}
              >
                <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {filterLabel(
                  entry,
                  open.filter((track) => PORTFOLIO_TRACK_FILTER_NEXT[entry].includes(track.next))
                    .length
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {platforms.length > 1 && (
        <Select
          value={platform ?? ALL_PLATFORMS}
          onValueChange={(value) =>
            onPlatformChange(value === ALL_PLATFORMS ? null : PortfolioWorkPlatform.parse(value))
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={translate('portfolio.platformFilter', 'Platform')}
            className="h-7 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLATFORMS}>
              {translate('portfolio.allPlatforms', 'All platforms')}
            </SelectItem>
            {platforms.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {workPlatformName(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
