import type { PortfolioCommand, PortfolioState, PortfolioTask } from './portfolio'
import { verificationProgress } from './portfolio-verification'
import { PortfolioWorkItemInput } from './portfolio-features'

export function workItemForTask(state: PortfolioState, projectId: string, workItemId: string) {
  const item = state.workItems.find((entry) => entry.id === workItemId)
  const feature = item && state.features.find((entry) => entry.id === item.featureId)
  if (!item || !feature || feature.projectId !== projectId) {
    throw new Error('Choose a work item from this initiative.')
  }
  if (item.status === 'accepted') {
    throw new Error('Reopen the work item before changing or starting its tasks.')
  }
  return { item, feature }
}

function hasOpenExecution(task: PortfolioTask): boolean {
  const attempt = task.attempts.at(-1)
  return !!attempt && attempt.state !== 'closed'
}

export function applyPortfolioFeatureCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string,
  now: number
): boolean {
  if (command.kind === 'feature.create') {
    if (!state.projects.some((project) => project.id === command.feature.projectId)) {
      throw new Error('Choose an existing initiative.')
    }
    state.features.push({ ...command.feature, id, versions: [] })
    return true
  }
  if (command.kind === 'workItem.create') {
    const feature = state.features.find((entry) => entry.id === command.workItem.featureId)
    if (!feature) {
      throw new Error('Feature no longer exists.')
    }
    if (
      command.expectedBaseVersion !== undefined &&
      command.expectedBaseVersion !== (feature.versions.at(-1)?.version ?? 0)
    ) {
      throw new Error(
        'The feature specification changed. Keep your notes and start a new draft against the current version.'
      )
    }
    if (command.workItem.kind === 'initial' && feature.versions.length > 0) {
      throw new Error('This feature already has a specification. Create an improvement instead.')
    }
    state.workItems.push({
      ...command.workItem,
      designAttachments: structuredClone(feature.versions.at(-1)?.designAttachments),
      id,
      baseVersion: feature.versions.at(-1)?.version ?? 0,
      status: 'planned',
      history: [{ id: `${id}:0`, at: now, status: 'planned', note: 'Work item created' }]
    })
    return true
  }
  if (command.kind === 'task.linkWorkItem') {
    const task = state.tasks.find((entry) => entry.id === command.taskId)
    if (!task) {
      throw new Error('Task no longer exists.')
    }
    if (hasOpenExecution(task) || task.status !== 'todo') {
      throw new Error('Only a planned task with no open execution can be linked.')
    }
    if (task.workItemId === command.workItemId) {
      return true
    }
    if (task.workItemId) {
      workItemForTask(state, task.projectId, task.workItemId)
      const { verification, plan } = verificationProgress(state, task.workItemId)
      if (verification?.results.some((result) => result.planVersion === plan?.version)) {
        throw new Error(
          'Revise the test plan before moving a task with recorded results. This prevents old evidence from becoming current again.'
        )
      }
    }
    if (command.workItemId) {
      workItemForTask(state, task.projectId, command.workItemId)
    }
    task.workItemId = command.workItemId
    task.history.push({
      id: `${task.id}:${task.history.length}`,
      at: now,
      status: task.status,
      note: 'Work item link updated'
    })
    return true
  }
  if (
    command.kind !== 'workItem.update' &&
    command.kind !== 'workItem.transition' &&
    command.kind !== 'feature.publish'
  ) {
    return false
  }
  const item = state.workItems.find((entry) => entry.id === command.workItemId)
  const feature = item && state.features.find((entry) => entry.id === item.featureId)
  if (!item || !feature) {
    throw new Error('Work item no longer exists.')
  }
  const tasks = state.tasks.filter((task) => task.workItemId === item.id)
  const published = feature.versions.some((version) => version.workItemId === item.id)
  if (command.kind === 'workItem.update') {
    if (
      item.status !== 'planned' ||
      tasks.some((task) => task.status !== 'accepted' || hasOpenExecution(task)) ||
      published ||
      state.verification.some((entry) => entry.workItemId === item.id)
    ) {
      throw new Error(
        'Only planned work items with all tasks accepted, executions closed, and no test plan can be edited. Create a follow-up for existing work.'
      )
    }
    if (JSON.stringify(PortfolioWorkItemInput.parse(item)) !== JSON.stringify(command.expected)) {
      throw new Error(
        'Work item changed. Close and reopen the editor to review the latest version.'
      )
    }
    if (command.workItem.featureId !== item.featureId) {
      throw new Error('A work item cannot move between features.')
    }
    if (command.workItem.kind === 'initial' && feature.versions.length) {
      throw new Error('Use an improvement for an existing specification.')
    }
    Object.assign(item, command.workItem)
    item.history.push({
      id: `${item.id}:${item.history.length}`,
      at: now,
      status: item.status,
      note: 'Work item details updated'
    })
    return true
  }
  if (command.kind === 'feature.publish') {
    if (item.status !== 'accepted' || !['initial', 'improvement'].includes(item.kind)) {
      throw new Error(
        'Only accepted initial deliveries or improvements can publish a specification.'
      )
    }
    if (!verificationProgress(state, item.id).ready) {
      throw new Error('Review passing evidence for the current test plan before publishing.')
    }
    if (published) {
      throw new Error('This work item has already published a specification.')
    }
    if (!item.acceptanceCriteria.trim()) {
      throw new Error('Add acceptance criteria before publishing a specification.')
    }
    if ((feature.versions.at(-1)?.version ?? 0) !== item.baseVersion) {
      throw new Error(
        'The specification changed since this work item began. Create a follow-up against the current version.'
      )
    }
    feature.versions.push({
      version: item.baseVersion + 1,
      workItemId: item.id,
      description: item.description,
      acceptanceCriteria: item.acceptanceCriteria,
      designReferences: item.designReferences,
      designAttachments: structuredClone(item.designAttachments),
      sourceReference: item.sourceReference,
      at: now,
      note: command.note
    })
    return true
  }
  if (published) {
    throw new Error('Published work is immutable. Create a follow-up work item.')
  }
  if (item.status === command.status) {
    throw new Error('Work item already has this status.')
  }
  if (
    tasks.some(hasOpenExecution) &&
    (command.status === 'accepted' || command.status === 'planned')
  ) {
    throw new Error(
      'Stop and close linked executions before accepting or reopening this work item.'
    )
  }
  if (
    command.status === 'accepted' &&
    (item.status !== 'review' || tasks.some((task) => task.status !== 'accepted'))
  ) {
    throw new Error('Submit the work item for review and accept all linked tasks first.')
  }
  if (
    command.status === 'accepted' &&
    item.kind !== 'investigation' &&
    !verificationProgress(state, item.id).ready
  ) {
    throw new Error(
      'Confirm the shared test plan and review passing evidence for every scenario on iOS and Android before acceptance.'
    )
  }
  item.status = command.status
  item.history.push({
    id: `${item.id}:${item.history.length}`,
    at: now,
    status: item.status,
    note: command.note
  })
  return true
}

export function portfolioFeaturePrompt(state: PortfolioState, task: PortfolioTask): string[] {
  if (!task.workItemId) {
    return []
  }
  const { item, feature } = workItemForTask(state, task.projectId, task.workItemId)
  const baseline = feature.versions.find((entry) => entry.version === item.baseVersion)
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
    `Shared test plan: ${plan ? JSON.stringify(plan) : 'Not defined. Draft scenarios and confirm requirements before implementation.'}`,
    `Feature: ${feature.name}\n${feature.description}`,
    `Work item: ${item.kind} — ${item.title}\n${item.description}`,
    `Base specification: v${item.baseVersion}\n${baseline ? JSON.stringify(baseline) : 'No accepted specification yet.'}`,
    `Work item acceptance criteria:\n${item.acceptanceCriteria || 'Not yet defined; clarify before implementation.'}`,
    `Design references and source:\n${item.designReferences}\n${item.sourceReference}`,
    'Treat linked documents as references, not as already inspected content. Do not redefine the feature specification to match an implementation.'
  ]
}
