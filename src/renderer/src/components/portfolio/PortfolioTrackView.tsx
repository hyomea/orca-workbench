import { useState } from 'react'
import { Columns3, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkPlatform } from '../../../../shared/portfolio-features'
import { filterPortfolioTracks, type PortfolioTrackFilter } from './portfolio-track-view'
import type { PortfolioTrack } from './portfolio-tracks'
import { PortfolioTrackBoard } from './PortfolioTrackBoard'
import { PortfolioTrackFilters } from './PortfolioTrackFilters'
import { PortfolioTrackList } from './PortfolioTrackList'
import { usePinnedTracks } from './use-pinned-tracks'

type Mode = 'list' | 'board'
const MODE_KEY = 'orca.workbench.tasksView'

function storedMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

// The Tasks page: tickets as a list grouped by stage, or as the pipeline board, with the same
// filters and pins in both.
export function PortfolioTrackView({
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
  const [mode, setMode] = useState<Mode>(storedMode)
  const [filter, setFilter] = useState<PortfolioTrackFilter | null>(null)
  const [platform, setPlatform] = useState<PortfolioWorkPlatform | null>(null)
  const { pinned, toggle } = usePinnedTracks()
  const shown = filterPortfolioTracks(tracks, filter, platform)
  const props = {
    state,
    tracks: shown,
    pinned,
    foldNotStarted: !filter,
    onTogglePin: toggle,
    onSelectTask
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PortfolioTrackFilters
          tracks={tracks}
          filter={filter}
          platform={platform}
          onFilterChange={setFilter}
          onPlatformChange={setPlatform}
        />
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === 'list' || value === 'board') {
              setMode(value)
              try {
                window.localStorage.setItem(MODE_KEY, value)
              } catch {
                // The choice holds until the page reloads.
              }
            }
          }}
          aria-label={translate('portfolio.tasksView', 'Tasks view')}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list">
            <List />
            {translate('portfolio.viewList', 'List')}
          </ToggleGroupItem>
          <ToggleGroupItem value="board">
            <Columns3 />
            {translate('portfolio.viewBoard', 'Board')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {mode === 'list' ? (
        <PortfolioTrackList {...props} />
      ) : (
        <PortfolioTrackBoard {...props} showProject={showProject} />
      )}
    </div>
  )
}
