import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { portfolioOutcomeInboxCount } from '../../../../shared/portfolio-outcome-reports'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioPin } from './PortfolioPin'
import { PortfolioTickets } from './PortfolioTickets'
import { workItemKinds } from './portfolio-feature-labels'
import { PortfolioOutcomePhaseBadge } from './PortfolioOutcomeProgress'
import {
  PORTFOLIO_OUTCOME_STATES,
  portfolioOutcomeState,
  type PortfolioOutcomeState
} from './portfolio-outcome-state'
import type { PortfolioTrack } from './portfolio-tracks'

const NO_FEATURES: readonly PortfolioFeature[] = []

export function outcomeStateName(outcome: PortfolioOutcomeState): string {
  switch (outcome) {
    case 'shaping':
      return translate('portfolio.stateShaping', 'Shaping')
    case 'readyToPlan':
      return translate('portfolio.stateReadyToPlan', 'Ready to plan')
    case 'inProgress':
      return translate('portfolio.stateInProgress', 'In progress')
    case 'signOff':
      return translate('portfolio.stateSignOff', 'Ready for sign-off')
    case 'signedOff':
      return translate('portfolio.stateSignedOff', 'Signed off')
  }
}

function OutcomeRow({
  state,
  tracks,
  item,
  outcome,
  features,
  pin,
  onSelect
}: {
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  item: PortfolioWorkItem
  outcome: PortfolioOutcomeState
  features: readonly PortfolioFeature[]
  pin?: { pinned: boolean; onToggle: () => void }
  onSelect: (id: string) => void
}): React.JSX.Element {
  const inbox = portfolioOutcomeInboxCount(state, item.id)
  return (
    <li className="group/pin flex items-center">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onSelect(item.id)}
        className="grid h-auto min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_1rem] gap-x-3 gap-y-2 rounded-none px-3 py-3 text-left font-normal whitespace-normal @2xl/work-items:grid-cols-[minmax(0,1fr)_9rem_8rem_1rem] @2xl/work-items:gap-x-4"
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
          {workItemKinds().find((kind) => kind.id === item.kind)?.name}
        </span>
        <span className="col-start-2 row-start-2 flex flex-col items-start gap-1 @2xl/work-items:col-auto @2xl/work-items:row-auto">
          {outcome === 'readyToPlan' ? (
            <ReadyToPlan state={state} item={item} />
          ) : (
            <PortfolioOutcomePhaseBadge state={state} item={item} tracks={tracks} />
          )}
          {inbox > 0 && (
            <Badge>
              {translate('portfolio.proposalsBadge', '{{count}} to review', {
                count: inbox,
                defaultValue_one: '{{count}} to review'
              })}
            </Badge>
          )}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="col-start-3 row-start-1 size-4 text-muted-foreground @2xl/work-items:col-auto @2xl/work-items:row-auto"
        />
      </Button>
      {pin && (
        <span className="pr-3">
          <PortfolioPin pinned={pin.pinned} label={item.title} onToggle={pin.onToggle} />
        </span>
      )}
    </li>
  )
}

type Section = PortfolioOutcomeState | 'pinned'

function sectionName(section: Section): string {
  return section === 'pinned'
    ? translate('portfolio.listPinned', 'Pinned')
    : outcomeStateName(section)
}

// Nothing has run yet, so the execution phase would mislead: say whether tasks are planned.
function ReadyToPlan({
  state,
  item
}: {
  state: PortfolioState
  item: PortfolioWorkItem
}): React.JSX.Element {
  const count = state.tasks.filter((task) => task.workItemId === item.id).length
  return (
    <Badge variant="outline">
      {count
        ? translate('portfolio.tasksPlanned', '{{count}} tasks planned', {
            count,
            defaultValue_one: '{{count}} task planned'
          })
        : translate('portfolio.noTasksPlanned', 'No tasks yet')}
    </Badge>
  )
}

// Outcomes grouped by where their definition stands; signed-off work starts folded away.
export function PortfolioWorkItemList({
  state,
  tracks,
  items,
  features = NO_FEATURES,
  pinned,
  onTogglePin,
  onSelect
}: {
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  items: PortfolioWorkItem[]
  features?: readonly PortfolioFeature[]
  // Where the user can pin, pinned outcomes come first, until they are signed off.
  pinned?: ReadonlySet<string>
  onTogglePin?: (id: string) => void
  onSelect: (id: string) => void
}): React.JSX.Element | null {
  const [toggled, setToggled] = useState<ReadonlySet<Section>>(() => new Set())
  if (!items.length) {
    return null
  }
  const sectionOf = (item: PortfolioWorkItem): Section => {
    const outcome = portfolioOutcomeState(state, item, tracks)
    return outcome !== 'signedOff' && pinned?.has(item.id) ? 'pinned' : outcome
  }
  const sections = (['pinned', ...PORTFOLIO_OUTCOME_STATES] as const)
    .map((key) => ({ key, items: items.filter((item) => sectionOf(item) === key) }))
    .filter((section) => section.items.length > 0)
  return (
    <section className="@container/work-items overflow-hidden rounded-md border border-border">
      {sections.map((section) => {
        const open = (section.key === 'signedOff') === toggled.has(section.key)
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
                className="h-9 w-full justify-start rounded-none border-b border-border/60 bg-muted/35 px-3 text-left font-normal hover:bg-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {open ? (
                  <ChevronDown className="size-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3 text-muted-foreground" />
                )}
                <span className="text-[13px] font-medium">{sectionName(section.key)}</span>
                <span className="text-[11px] text-muted-foreground">{section.items.length}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul
                aria-label={sectionName(section.key)}
                className="divide-y divide-border border-b border-border/60"
              >
                {section.items.map((item) => (
                  <OutcomeRow
                    key={item.id}
                    state={state}
                    tracks={tracks}
                    item={item}
                    outcome={portfolioOutcomeState(state, item, tracks)}
                    features={features}
                    pin={
                      pinned && onTogglePin
                        ? { pinned: pinned.has(item.id), onToggle: () => onTogglePin(item.id) }
                        : undefined
                    }
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </section>
  )
}
