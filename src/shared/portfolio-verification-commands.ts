import { applyPortfolioCommand, type PortfolioCommand, type PortfolioState } from './portfolio'
import { portfolioChecklistText } from './portfolio-checklist'
import {
  developmentExecutionOpen,
  verificationProgress,
  verificationTaskSnapshot
} from './portfolio-verification'
import { portfolioTicketsText } from './portfolio-features'
import { returnPortfolioFindings } from './portfolio-task-stages'

export function applyPortfolioVerificationCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string,
  now: number
): boolean {
  if (
    command.kind !== 'verification.plan' &&
    command.kind !== 'verification.confirm' &&
    command.kind !== 'verification.record' &&
    command.kind !== 'verification.review' &&
    command.kind !== 'verification.fix'
  ) {
    return false
  }
  const item = state.workItems.find((entry) => entry.id === command.workItemId)
  if (!item || item.status === 'accepted') {
    throw new Error('Choose an open outcome before changing verification.')
  }
  const feature = state.features.find((entry) => entry.id === item.featureId)
  if (feature?.versions.some((version) => version.workItemId === item.id)) {
    throw new Error('Published work is immutable. Create a follow-up work item.')
  }
  const progress = verificationProgress(state, item.id)
  const { plan } = progress
  const verification = progress.verification ?? { workItemId: item.id, plans: [], results: [] }
  if (command.kind === 'verification.plan') {
    if (command.expectedVersion !== (plan?.version ?? 0)) {
      throw new Error('The test plan changed. Reopen the editor before saving.')
    }
    if (!item.acceptanceCriteria.trim()) {
      throw new Error('Define acceptance criteria before creating a test plan.')
    }
    if (
      new Set(command.scenarios.map((scenario) => scenario.id)).size !== command.scenarios.length
    ) {
      throw new Error('Each scenario needs a unique ID.')
    }
    verification.plans.push({
      version: (plan?.version ?? 0) + 1,
      scenarios: command.scenarios,
      acceptanceCriteria: portfolioChecklistText(item),
      designReferences: item.designReferences,
      designAttachments: structuredClone(item.designAttachments),
      sourceReference: portfolioTicketsText(item.tickets),
      at: now,
      note: command.note
    })
    if (!progress.verification) {
      state.verification.push(verification)
    }
    return true
  }
  if (!plan) {
    throw new Error('Create a shared test plan first.')
  }
  if ('planVersion' in command && command.planVersion !== plan.version) {
    throw new Error('The test plan changed. Review the current plan first.')
  }
  if (command.kind === 'verification.confirm') {
    if (plan.confirmation) {
      throw new Error('This plan is already confirmed.')
    }
    plan.confirmation = { at: now, note: command.note }
    return true
  }
  if (!plan.confirmation) {
    throw new Error('Confirm scenario coverage before recording or reviewing tests.')
  }
  if (command.kind === 'verification.record') {
    if (command.expectedTaskSnapshot !== verificationTaskSnapshot(state, item.id)) {
      throw new Error('Work changed while the result form was open. Run the test again.')
    }
    if (!plan.scenarios.some((scenario) => scenario.id === command.result.scenarioId)) {
      throw new Error('Choose a scenario from the current plan.')
    }
    if (developmentExecutionOpen(state, item.id)) {
      throw new Error(
        'Stop and close linked development executions before recording a test result.'
      )
    }
    verification.results.push({
      ...command.result,
      id,
      planVersion: plan.version,
      taskSnapshot: verificationTaskSnapshot(state, item.id),
      at: now
    })
    return true
  }
  const result = verification.results.find((entry) => entry.id === command.resultId)
  const cell = progress.cells.find((entry) => entry.result?.id === result?.id)
  if (!result || !cell || (command.kind === 'verification.review' && !cell.current)) {
    throw new Error('This result is outdated. Record a new test result.')
  }
  if (command.kind === 'verification.review') {
    if (result.review) {
      throw new Error('This result was already reviewed. Record a new result to supersede it.')
    }
    result.review = { decision: command.decision, note: command.note, at: now }
    return true
  }
  if (result.fixTaskId || (result.outcome === 'pass' && result.review?.decision !== 'rejected')) {
    throw new Error('Choose a failed, blocked, or rejected result without a linked fix.')
  }
  // A platform with a development task gets the failure back in that same session.
  const development = state.tasks.findLast(
    (task) =>
      task.stage === 'development' &&
      task.workItemId === item.id &&
      task.platform === result.platform
  )
  if (development) {
    returnPortfolioFindings(
      state,
      development,
      'qa',
      `${result.platform} result ${result.id} (${result.outcome}) for scenario ${cell.scenario.id}: ${cell.scenario.criterion}\n${result.evidence}${result.review ? `\nReview: ${result.review.note}` : ''}`,
      now
    )
    result.fixTaskId = development.id
  } else {
    applyPortfolioCommand(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: item.projectId,
          workItemId: item.id,
          roleId: command.roleId,
          platform: result.platform,
          stage: 'development',
          title: `Fix ${result.platform}: ${cell.scenario.criterion}`.slice(0, 200),
          instructions: `Resolve finding ${result.id} on ${result.platform}. The execution context includes its original scenario, build, environment, evidence, and review. Verify the fix against the current shared test plan.`,
          acceptanceCriteria: `${cell.scenario.expected}\n${cell.scenario.platformNotes}\nRe-run the shared plan on iOS and Android after the fix; attach fresh evidence for review.`
        }
      },
      id,
      now
    )
    result.fixTaskId = id
  }
  item.history.push({
    id: `${item.id}:${item.history.length}`,
    at: now,
    status: item.status,
    note: development
      ? `Returned to development from ${result.platform} result ${result.id}`
      : `Fix task created from ${result.platform} result ${result.id}`
  })
  return true
}
