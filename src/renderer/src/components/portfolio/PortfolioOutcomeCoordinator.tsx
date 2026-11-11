import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { portfolioCoordinatorRole } from '../../../../shared/portfolio-outcome-coordinator'
import {
  PORTFOLIO_OUTCOME_COORDINATOR,
  portfolioRoleLabel
} from '../../../../shared/portfolio-roles'
import { portfolioOutcomeState } from './portfolio-outcome-state'
import { openOutcomeCoordinator } from './portfolio-steward-actions'
import type { PortfolioTrack } from './portfolio-tracks'

// The outcome's own coordinator. The workbench coordinator shapes an outcome; once it is ready
// to plan, the user starts this one, which holds the outcome until the user hands it back.
export function PortfolioOutcomeCoordinator({
  state,
  item,
  tracks,
  busy,
  onSave
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  tracks: readonly PortfolioTrack[]
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element | null {
  const [error, setError] = useState('')
  const outcome = portfolioOutcomeState(state, item, tracks)
  const role = portfolioCoordinatorRole(state)
  const held =
    item.coordinator && state.roles.find((entry) => entry.id === item.coordinator?.roleId)
  if (outcome === 'signedOff' || (!item.coordinator && outcome === 'shaping')) {
    return null
  }
  const open = () => {
    setError('')
    openOutcomeCoordinator(item.id).catch((failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {item.coordinator ? (
          <>
            <Button variant="outline" size="sm" disabled={busy} onClick={open}>
              <Bot aria-hidden="true" />
              {held
                ? portfolioRoleLabel(held)
                : translate('portfolio.outcomeCoordinator', 'Outcome coordinator')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onSave({ kind: 'workItem.handBack', workItemId: item.id })}
            >
              {translate('portfolio.handBack', 'Hand back')}
            </Button>
          </>
        ) : role ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={open}>
            <Bot aria-hidden="true" />
            {translate('portfolio.startCoordinator', 'Start coordinator')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void onSave({ kind: 'role.create', role: PORTFOLIO_OUTCOME_COORDINATOR })
            }
          >
            {translate('portfolio.addOutcomeCoordinator', 'Add outcome coordinator')}
          </Button>
        )}
      </div>
      {item.coordinator && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.coordinatorHolds',
            'The workbench coordinator leaves this outcome to it until you hand it back.'
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-sm text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
