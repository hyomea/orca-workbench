import type { PortfolioCommand, PortfolioState, PortfolioTask } from './portfolio'
import { portfolioChecklistText, portfolioChecklistWithCriteria } from './portfolio-checklist'
import { verificationProgress } from './portfolio-verification'
import { PortfolioWorkItemInput, portfolioTicketsText } from './portfolio-features'
import { applyFeatureChange, featureInProject } from './portfolio-feature-records'
import { assertPortfolioTicketRoles } from './portfolio-ticket-roles'

export function workItemForTask(state: PortfolioState, projectId: string, workItemId: string) {
  const item = state.workItems.find((entry) => entry.id === workItemId)
  if (!item || item.projectId !== projectId) {
    throw new Error('Choose an outcome from this initiative.')
  }
  const feature = state.features.find((entry) => entry.id === item.featureId)
  if (item.status === 'accepted') {
    throw new Error('Reopen the outcome before changing or starting its tasks.')
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
    if (!state.projects.some((project) => project.id === command.workItem.projectId)) {
      throw new Error('Choose an existing initiative.')
    }
    const feature = featureInProject(state, command.workItem)
    const latest = feature?.versions.at(-1)
    if (
      command.expectedBaseVersion !== undefined &&
      command.expectedBaseVersion !== (latest?.version ?? 0)
    ) {
      throw new Error(
        'The feature specification changed. Keep your notes and start a new draft against the current version.'
      )
    }
    if (command.workItem.kind === 'initial' && latest) {
      throw new Error('This feature already has a specification. Create an improvement instead.')
    }
    assertPortfolioTicketRoles(state, { id }, command.workItem.tickets)
    state.workItems.push({
      ...command.workItem,
      designAttachments: structuredClone(latest?.designAttachments),
      id,
      baseVersion: latest?.version ?? 0,
      status: 'planned',
      history: [{ id: `${id}:0`, at: now, status: 'planned', note: 'Outcome created' }]
    })
    return true
  }
  if (
    command.kind === 'feature.update' ||
    command.kind === 'feature.delete' ||
    command.kind === 'feature.parity'
  ) {
    return applyFeatureChange(state, command)
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
    command.kind !== 'workItem.scope' &&
    command.kind !== 'feature.publish'
  ) {
    return false
  }
  const item = state.workItems.find((entry) => entry.id === command.workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists.')
  }
  const feature = state.features.find((entry) => entry.id === item.featureId)
  const tasks = state.tasks.filter((task) => task.workItemId === item.id)
  const published = !!feature?.versions.some((version) => version.workItemId === item.id)
  // Tickets, parity, and the feature link can change while work is in progress; acceptance and
  // publication check whatever is set at that point.
  if (command.kind === 'workItem.scope') {
    if (item.status === 'accepted' || published) {
      throw new Error('Reopen the outcome before changing its tickets or parity.')
    }
    assertPortfolioTicketRoles(state, item, command.tickets)
    item.tickets = command.tickets
    item.parity = command.parity
    if (command.qaFeedbackUrl === null) {
      delete item.qaFeedbackUrl
    } else if (command.qaFeedbackUrl !== undefined) {
      item.qaFeedbackUrl = command.qaFeedbackUrl
    }
    if (command.feature === null) {
      delete item.featureId
    } else if (command.feature !== undefined && command.feature !== item.featureId) {
      const target = featureInProject(state, {
        projectId: item.projectId,
        featureId: command.feature
      })
      item.featureId = command.feature
      item.baseVersion = target?.versions.at(-1)?.version ?? 0
    }
    item.history.push({
      id: `${item.id}:${item.history.length}`,
      at: now,
      status: item.status,
      note: `Tickets, parity, or feature link updated; same behavior on iOS and Android ${command.parity ? '' : 'not '}required`
    })
    return true
  }
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
    if (command.workItem.projectId !== item.projectId) {
      throw new Error('An outcome cannot move between initiatives.')
    }
    if (item.featureId && command.workItem.featureId !== item.featureId) {
      throw new Error('An outcome cannot move between features.')
    }
    const target = featureInProject(state, command.workItem)
    if (command.workItem.kind === 'initial' && target?.versions.length) {
      throw new Error('Use an improvement for an existing specification.')
    }
    assertPortfolioTicketRoles(state, item, command.workItem.tickets)
    if (target && !item.featureId) {
      item.baseVersion = target.versions.at(-1)?.version ?? 0
    }
    // A stored checklist keeps its decisions and the criteria that did not change.
    const checklist =
      item.checklist &&
      portfolioChecklistWithCriteria(item, command.workItem.acceptanceCriteria, now)
    Object.assign(item, command.workItem)
    if (checklist) {
      item.checklist = checklist
    }
    if (!command.workItem.featureId) {
      delete item.featureId
    }
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
      throw new Error('Only accepted new capabilities or improvements can publish a specification.')
    }
    if (item.parity && !verificationProgress(state, item.id).ready) {
      throw new Error('Review passing evidence for the current test plan before publishing.')
    }
    const target =
      feature ??
      featureInProject(state, { projectId: item.projectId, featureId: command.featureId })
    if (!target) {
      throw new Error('Choose the feature this specification belongs to.')
    }
    if (!feature) {
      // Linked at publish time, so the outcome builds on whatever the feature holds now.
      item.featureId = target.id
      item.baseVersion = target.versions.at(-1)?.version ?? 0
    }
    if (published) {
      throw new Error('This work item has already published a specification.')
    }
    if (!item.acceptanceCriteria.trim()) {
      throw new Error('Add acceptance criteria before publishing a specification.')
    }
    if ((target.versions.at(-1)?.version ?? 0) !== item.baseVersion) {
      throw new Error(
        'The specification changed since this work item began. Create a follow-up against the current version.'
      )
    }
    target.versions.push({
      version: item.baseVersion + 1,
      workItemId: item.id,
      description: item.description,
      acceptanceCriteria: portfolioChecklistText(item),
      designReferences: item.designReferences,
      designAttachments: structuredClone(item.designAttachments),
      sourceReference: portfolioTicketsText(item.tickets),
      at: now,
      note: command.note
    })
    return true
  }
  if (published) {
    throw new Error('Published work is immutable. Create a follow-up work item.')
  }
  if (item.status === command.status) {
    throw new Error(
      command.status === 'accepted' ? 'Outcome is already signed off.' : 'Outcome is already open.'
    )
  }
  if (tasks.some(hasOpenExecution)) {
    throw new Error('Stop and close linked executions before signing off or reopening the outcome.')
  }
  if (command.status === 'accepted' && tasks.some((task) => task.status !== 'accepted')) {
    throw new Error('Accept all linked tasks before signing off the outcome.')
  }
  if (command.status === 'accepted' && item.proposals?.length) {
    throw new Error('Accept or dismiss the proposed checklist changes before signing off.')
  }
  if (command.status === 'accepted' && item.parity && !verificationProgress(state, item.id).ready) {
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
