import type { PortfolioState, PortfolioTask } from './portfolio'
import { portfolioChecklistText } from './portfolio-checklist'
import { workItemForTask } from './portfolio-feature-commands'
import { portfolioTicketsText } from './portfolio-features'
import { verificationProgress } from './portfolio-verification'

// What a task's agent is told about its outcome: the feature, the shared test plan, and what
// "done" means (the checklist's criteria and decisions).
export function portfolioFeaturePrompt(state: PortfolioState, task: PortfolioTask): string[] {
  if (!task.workItemId) {
    return []
  }
  const { item, feature } = workItemForTask(state, task.projectId, task.workItemId)
  const baseline = feature?.versions.find((entry) => entry.version === item.baseVersion)
  const verification = verificationProgress(state, item.id).verification
  const plan = verification?.plans.at(-1)
  const finding = verification?.results.find((result) => result.fixTaskId === task.id)
  const findingScenario =
    finding &&
    verification?.plans
      .find((entry) => entry.version === finding.planVersion)
      ?.scenarios.find((scenario) => scenario.id === finding.scenarioId)
  return [
    `Target platform: ${task.platform ?? 'shared'}`,
    ...(finding
      ? [
          `Test finding and original scenario:\n${JSON.stringify({ finding, scenario: findingScenario })}`
        ]
      : []),
    `Shared test plan: ${plan ? JSON.stringify(plan) : item.parity ? 'Not defined. Draft scenarios and confirm requirements before implementation.' : 'Not required: this outcome does not need identical behavior on iOS and Android.'}`,
    ...(feature
      ? [
          `Feature: ${feature.name}\n${feature.description}`,
          `Base specification: v${item.baseVersion}\n${baseline ? JSON.stringify(baseline) : 'No accepted specification yet.'}`
        ]
      : []),
    `Outcome: ${item.kind} — ${item.title}\n${item.description}`,
    `Same behavior on iOS and Android required: ${item.parity ? 'yes' : 'no'}`,
    `Outcome acceptance criteria:\n${portfolioChecklistText(item) || 'Not yet defined; clarify before implementation.'}`,
    'When your work turns up a criterion or decision this checklist should hold, or the user agrees one with you, propose it with `orca workbench outcome propose`; it changes only when the user accepts it.',
    `Tickets:\n${portfolioTicketsText(item.tickets) || 'None linked.'}`,
    `Design references:\n${item.designReferences}`,
    'Treat linked documents as references, not as already inspected content. Do not redefine the feature specification to match an implementation.'
  ]
}
