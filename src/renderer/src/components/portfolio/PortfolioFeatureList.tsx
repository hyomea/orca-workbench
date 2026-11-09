import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { parityStatusName } from './portfolio-parity-labels'
import type { PortfolioTask } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'

export function PortfolioFeatureList({
  features,
  workItems,
  tasks,
  onSelect
}: {
  features: PortfolioFeature[]
  workItems: PortfolioWorkItem[]
  // A blocked task blocks its outcome.
  tasks: readonly PortfolioTask[]
  onSelect: (id: string) => void
}): React.JSX.Element | null {
  if (!features.length) {
    return null
  }
  return (
    <div className="@container/feature-list">
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1fr)_10rem_14rem_1rem] gap-4 px-3 pb-2 text-xs text-muted-foreground @2xl/feature-list:grid"
      >
        <span>{translate('portfolio.featureColumn', 'Feature')}</span>
        <span>{translate('portfolio.workItemsColumn', 'Outcomes')}</span>
        <span>{translate('portfolio.specificationColumn', 'Specification')}</span>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        {features.map((feature) => {
          const items = workItems.filter((item) => item.featureId === feature.id)
          const accepted = items.filter((item) => item.status === 'accepted').length
          const blocked = items.filter(
            (item) =>
              item.status !== 'accepted' &&
              tasks.some((task) => task.workItemId === item.id && task.status === 'blocked')
          ).length
          const current = feature.versions.at(-1)
          return (
            <li key={feature.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelect(feature.id)}
                className="grid h-auto w-full grid-cols-[minmax(0,1fr)_1rem] gap-x-4 gap-y-2 rounded-none px-3 py-3 text-left font-normal whitespace-normal @2xl/feature-list:grid-cols-[minmax(0,1fr)_10rem_14rem_1rem]"
              >
                <span className="min-w-0 space-y-1">
                  <span className="block break-words text-sm font-medium">{feature.name}</span>
                  {feature.description && (
                    <span className="line-clamp-1 break-words text-sm text-muted-foreground">
                      {feature.description}
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {feature.parity
                      ? translate('portfolio.parityRow', 'iOS: {{ios}} · Android: {{android}}', {
                          ios: parityStatusName(feature.parity.ios.status),
                          android: parityStatusName(feature.parity.android.status)
                        })
                      : translate('portfolio.parityNotChecked', 'Parity not checked')}
                  </span>
                </span>
                <span className="col-start-1 row-start-2 flex flex-wrap gap-x-2 text-xs text-muted-foreground @2xl/feature-list:col-auto @2xl/feature-list:row-auto @2xl/feature-list:block">
                  <span className="block">
                    {items.length
                      ? translate(
                          'portfolio.featureWorkSummary',
                          '{{open}} open · {{accepted}} accepted',
                          { open: items.length - accepted, accepted }
                        )
                      : translate('portfolio.featureNoWork', 'No outcomes')}
                  </span>
                  {blocked > 0 && (
                    <span className="block @2xl/feature-list:mt-1">
                      {translate('portfolio.featureBlockedCount', '{{count}} blocked', {
                        count: blocked
                      })}
                    </span>
                  )}
                </span>
                <span className="col-start-1 row-start-3 text-xs text-muted-foreground @2xl/feature-list:col-auto @2xl/feature-list:row-auto">
                  {current
                    ? translate('portfolio.featurePublishedVersion', 'Published v{{version}}', {
                        version: current.version
                      })
                    : translate('portfolio.noSpecification', 'No published specification yet')}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="col-start-2 row-start-1 size-4 text-muted-foreground @2xl/feature-list:col-auto @2xl/feature-list:row-auto"
                />
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
