import type { PortfolioTask } from '../../../../shared/portfolio'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

export type PortfolioTaskLane = 'decide' | 'attention' | 'running' | 'ready' | 'accepted'

export type PortfolioTaskAttention =
  | 'blocked'
  | 'launch-uncertain'
  | 'agent-needs-input'
  | 'agent-stopped'
  | 'agent-unseen'
  // Code review or QA looked at a commit development has since replaced.
  | 'outdated'

// A launch that has not reported in yet is still starting, not lost.
const STARTUP_GRACE_MS = 2 * 60 * 1000

// The status Orca last observed for the task's latest launch, ignoring older sessions in the same pane.
export function portfolioTaskObservation(
  task: PortfolioTask,
  activity: Readonly<Record<string, AgentStatusEntry>>
): AgentStatusEntry | undefined {
  const attempt = task.attempts.at(-1)
  if (!attempt) {
    return undefined
  }
  return Object.values(activity).find(
    (entry) =>
      ((attempt.paneKey && entry.paneKey === attempt.paneKey) ||
        (attempt.handle && entry.terminalHandle === attempt.handle)) &&
      !entry.restoredUnconfirmed &&
      (entry.evidenceObservedAt ?? entry.updatedAt) >= attempt.createdAt
  )
}

// Lanes answer "who acts next": the user decides, the user unblocks, the agent works, or nobody started yet.
export function portfolioTaskLane(
  task: PortfolioTask,
  observation: AgentStatusEntry | undefined,
  now: number,
  outdated = false
): { lane: PortfolioTaskLane; attention?: PortfolioTaskAttention } {
  const attempt = task.attempts.at(-1)
  // Planned work simply looks at the latest commit when it runs again.
  if (outdated && task.status !== 'todo') {
    return { lane: 'attention', attention: 'outdated' }
  }
  if (task.status === 'accepted') {
    return { lane: 'accepted' }
  }
  if (task.status === 'review') {
    return { lane: 'decide' }
  }
  if (task.status === 'blocked') {
    return { lane: 'attention', attention: 'blocked' }
  }
  if (attempt && (attempt.state === 'pending' || attempt.state === 'unknown')) {
    return { lane: 'attention', attention: 'launch-uncertain' }
  }
  if (task.status === 'todo') {
    return { lane: 'ready' }
  }
  // Running: the agent has not submitted its result yet.
  if (observation?.state === 'working') {
    return { lane: 'running' }
  }
  if (observation?.state === 'waiting' || observation?.state === 'blocked') {
    return { lane: 'attention', attention: 'agent-needs-input' }
  }
  if (observation?.state === 'done') {
    return { lane: 'attention', attention: 'agent-stopped' }
  }
  if (!attempt || now - attempt.createdAt < STARTUP_GRACE_MS) {
    return { lane: 'running' }
  }
  return { lane: 'attention', attention: 'agent-unseen' }
}
