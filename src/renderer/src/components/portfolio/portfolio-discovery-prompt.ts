import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'

// What the user asks the steward when they start discussing a discovery outcome.
export function portfolioDiscussPrompt(state: PortfolioState, item: PortfolioWorkItem): string {
  const project = state.projects.find((entry) => entry.id === item.projectId)?.name
  return [
    `Let's work out the discovery outcome "${item.title}" (id ${item.id}) in the initiative ${project ?? item.projectId}.`,
    ...(item.description.trim() ? [`What I wrote so far: ${item.description.trim()}`] : []),
    ...(item.findings ? ['Its findings so far are recorded on the outcome.'] : []),
    'Follow "Discovery" in your instructions: ask me what you need, record findings as we go, and propose a conclusion when we are ready.'
  ].join('\n')
}
