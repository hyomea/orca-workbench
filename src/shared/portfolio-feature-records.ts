import type { PortfolioCommand, PortfolioState } from './portfolio'
import type { PortfolioFeature } from './portfolio-features'

export function featureInProject(
  state: PortfolioState,
  link: { projectId: string; featureId?: string }
): PortfolioFeature | undefined {
  if (!link.featureId) {
    return undefined
  }
  const feature = state.features.find((entry) => entry.id === link.featureId)
  if (!feature || feature.projectId !== link.projectId) {
    throw new Error('Choose a feature from this initiative.')
  }
  return feature
}

export function applyFeatureChange(
  state: PortfolioState,
  command: Extract<PortfolioCommand, { kind: 'feature.update' | 'feature.delete' }>
): boolean {
  const index = state.features.findIndex((entry) => entry.id === command.featureId)
  const feature = state.features[index]
  if (!feature) {
    throw new Error('Feature no longer exists. Refresh and try again.')
  }
  if (command.kind === 'feature.delete') {
    if (state.workItems.some((item) => item.featureId === feature.id)) {
      throw new Error('Only a feature with no outcomes can be deleted.')
    }
    state.features.splice(index, 1)
    return true
  }
  if (
    feature.name !== command.expected.name ||
    feature.description !== command.expected.description
  ) {
    throw new Error('Feature changed. Close and reopen this form to review the latest version.')
  }
  feature.name = command.feature.name
  feature.description = command.feature.description
  return true
}
