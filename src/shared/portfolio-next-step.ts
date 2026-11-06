import type { PortfolioState } from './portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from './portfolio-features'
import { canEditPortfolioContext } from './portfolio-design'
import { verificationProgress } from './portfolio-verification'

export function portfolioNextStep(
  state: PortfolioState,
  feature: PortfolioFeature | undefined,
  item: PortfolioWorkItem
) {
  if (feature?.versions.some((version) => version.workItemId === item.id)) {
    return 'published'
  }
  if (item.status === 'accepted') {
    // Publishing is how an outcome updates a feature; outcomes without one are simply done.
    if (feature && (item.kind === 'initial' || item.kind === 'improvement')) {
      if (item.parity && !verificationProgress(state, item.id).ready) {
        return 'reverify'
      }
      return (feature.versions.at(-1)?.version ?? 0) === item.baseVersion ? 'publish' : 'followUp'
    }
    return 'complete'
  }
  const tasks = state.tasks.filter((task) => task.workItemId === item.id)
  if (
    tasks.some(
      (task) =>
        task.status !== 'accepted' ||
        (task.attempts.length && task.attempts.at(-1)?.state !== 'closed')
    )
  ) {
    return 'tasks'
  }
  if (item.kind === 'investigation') {
    // Discovery happens in conversation with the steward; it ends with a conclusion, not tasks.
    return 'discuss'
  }
  if (!item.acceptanceCriteria.trim()) {
    return canEditPortfolioContext(state, item.id) ? 'requirements' : 'reopen'
  }
  if (!item.parity) {
    return 'review'
  }
  const progress = verificationProgress(state, item.id)
  if (!progress.plan) {
    return 'plan'
  }
  if (!progress.plan.confirmation) {
    return 'confirm'
  }
  if (!progress.ready) {
    return 'verify'
  }
  return 'review'
}
