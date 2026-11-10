import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { portfolioOutcomePhase } from './portfolio-outcome-phase'
import type { PortfolioTrack } from './portfolio-tracks'

// Where an outcome's definition stands, which is what Workbench is for: shaping it, ready to
// plan, being built (followed on the Tasks page), waiting for sign-off, or signed off.
export type PortfolioOutcomeState =
  | 'shaping'
  | 'readyToPlan'
  | 'inProgress'
  | 'signOff'
  | 'signedOff'

export const PORTFOLIO_OUTCOME_STATES: readonly PortfolioOutcomeState[] = [
  'shaping',
  'readyToPlan',
  'inProgress',
  'signOff',
  'signedOff'
]

export function portfolioOutcomeState(
  state: PortfolioState,
  item: PortfolioWorkItem,
  tracks: readonly PortfolioTrack[]
): PortfolioOutcomeState {
  const { phase } = portfolioOutcomePhase(state, item, tracks)
  if (phase === 'published' || phase === 'signedOff') {
    return 'signedOff'
  }
  if (phase === 'verification' || phase === 'signOff') {
    return 'signOff'
  }
  if (phase === 'discovery' || !item.acceptanceCriteria.trim()) {
    return 'shaping'
  }
  // Work began once any of its tasks ran or moved on from planned.
  const started = state.tasks.some(
    (task) => task.workItemId === item.id && (task.attempts.length > 0 || task.status !== 'todo')
  )
  return started ? 'inProgress' : 'readyToPlan'
}
