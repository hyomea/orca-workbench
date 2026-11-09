import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioTickets } from './PortfolioTickets'
import { workItemKinds } from './portfolio-feature-labels'
import { PortfolioOutcomePhaseBadge } from './PortfolioOutcomeProgress'
import type { PortfolioTrack } from './portfolio-tracks'

const NO_FEATURES: readonly PortfolioFeature[] = []
export function PortfolioWorkItemList({
  state,
  tracks,
  items,
  features = NO_FEATURES,
  onSelect
}: {
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  items: PortfolioWorkItem[]
  features?: readonly PortfolioFeature[]
  onSelect: (id: string) => void
}): React.JSX.Element | null {
  if (!items.length) {
    return null
  }
  const kinds = workItemKinds()
  return (
    <section className="@container/work-items space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        {translate('portfolio.outcomes', 'Outcomes')}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </h4>
      <div>
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_1rem] gap-4 px-3 pb-2 text-xs text-muted-foreground @2xl/work-items:grid"
        >
          <span>{translate('portfolio.outcomeColumn', 'Outcome')}</span>
          <span>{translate('portfolio.workType', 'Work type')}</span>
          <span>{translate('portfolio.workPhaseColumn', 'Phase')}</span>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelect(item.id)}
                className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto_1rem] gap-x-3 gap-y-2 rounded-none px-3 py-3 text-left font-normal whitespace-normal @2xl/work-items:grid-cols-[minmax(0,1fr)_9rem_7rem_1rem] @2xl/work-items:gap-x-4"
              >
                <span className="col-span-2 min-w-0 space-y-1 @2xl/work-items:col-span-1">
                  <span className="block break-words text-sm font-medium">{item.title}</span>
                  {item.description && (
                    <span className="line-clamp-1 break-words text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  {(item.featureId || item.parity) && (
                    <span className="block text-xs text-muted-foreground">
                      {[
                        features.find((feature) => feature.id === item.featureId)?.name,
                        item.parity
                          ? translate('portfolio.parityBadge', 'Same on iOS and Android')
                          : undefined
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <PortfolioTickets tickets={item.tickets} />
                </span>
                <span className="col-start-1 row-start-2 text-xs text-muted-foreground @2xl/work-items:col-auto @2xl/work-items:row-auto">
                  {kinds.find((kind) => kind.id === item.kind)?.name}
                </span>
                <span className="col-start-2 row-start-2 @2xl/work-items:col-auto @2xl/work-items:row-auto">
                  <PortfolioOutcomePhaseBadge state={state} item={item} tracks={tracks} />
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="col-start-3 row-start-1 size-4 text-muted-foreground @2xl/work-items:col-auto @2xl/work-items:row-auto"
                />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
