import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import { verificationProgress } from '../../../../shared/portfolio-verification'
import type { PortfolioTrack } from './portfolio-tracks'

export type PortfolioOutcomePhase =
  | 'published'
  | 'signedOff'
  | 'discovery'
  | 'planning'
  | PortfolioTaskStage
  | 'merge'
  | 'verification'
  | 'signOff'

const PHASE_ORDER: Record<PortfolioTrack['current'] | 'planning', number> = {
  planning: 0,
  development: 1,
  codeReview: 2,
  qa: 3,
  merge: 4,
  done: 5,
  external: 6
}

// Where an outcome stands. Only sign-off is stored; otherwise its tracks decide, and the
// platform furthest behind sets the phase. attention: some track needs the user's help.
export function portfolioOutcomePhase(
  state: PortfolioState,
  item: PortfolioWorkItem,
  tracks: readonly PortfolioTrack[]
): { phase: PortfolioOutcomePhase; attention: boolean } {
  const own = tracks.filter((track) => track.item?.id === item.id)
  const attention = own.some((track) => track.next === 'attention')
  const published = state.features.some(
    (feature) =>
      feature.id === item.featureId &&
      feature.versions.some((version) => version.workItemId === item.id)
  )
  if (published) {
    return { phase: 'published', attention: false }
  }
  if (item.status === 'accepted') {
    return { phase: 'signedOff', attention: false }
  }
  if (item.kind === 'investigation') {
    return { phase: 'discovery', attention: false }
  }
  if (!item.acceptanceCriteria.trim() || !own.length) {
    return { phase: 'planning', attention }
  }
  let behind: PortfolioTrack['current'] | 'planning' = 'external'
  for (const track of own) {
    const at = track.next === 'plan' ? 'planning' : track.current
    if (PHASE_ORDER[at] < PHASE_ORDER[behind]) {
      behind = at
    }
  }
  if (behind !== 'done' && behind !== 'external') {
    return { phase: behind, attention }
  }
  if (item.parity && !verificationProgress(state, item.id).ready) {
    return { phase: 'verification', attention }
  }
  return { phase: 'signOff', attention }
}
