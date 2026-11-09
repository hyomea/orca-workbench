import { expect, it } from 'vitest'
import type { PortfolioTask } from '../../../../shared/portfolio'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { portfolioTaskLane, portfolioTaskObservation } from './portfolio-task-lanes'

const launchedAt = 1_000_000

function task(
  status: PortfolioTask['status'],
  attempt?: Partial<PortfolioTask['attempts'][number]>
): PortfolioTask {
  return {
    id: 't1',
    projectId: 'p',
    roleId: 'r',
    title: 'Port the testing foundation',
    instructions: 'Port it',
    acceptanceCriteria: 'Tests pass',
    status,
    evidence: '',
    stage: 'development',
    steps: [],
    history: [],
    attempts: attempt
      ? [
          {
            operationId: 'op',
            worktreeId: 'w',
            agent: 'claude',
            prompt: 'p',
            createdAt: launchedAt,
            state: 'launched',
            paneKey: 'pane-1',
            ...attempt
          }
        ]
      : []
  } as PortfolioTask
}

function status(state: AgentStatusEntry['state'], at = launchedAt + 1): AgentStatusEntry {
  return {
    state,
    paneKey: 'pane-1',
    prompt: '',
    updatedAt: at,
    stateStartedAt: at
  } as AgentStatusEntry
}

it('puts submitted, planned, and accepted tasks where the user expects them', () => {
  expect(portfolioTaskLane(task('review', {}), undefined, launchedAt)).toEqual({ lane: 'decide' })
  expect(portfolioTaskLane(task('todo'), undefined, launchedAt)).toEqual({ lane: 'ready' })
  expect(portfolioTaskLane(task('accepted', {}), undefined, launchedAt)).toEqual({
    lane: 'accepted'
  })
  expect(portfolioTaskLane(task('blocked', {}), undefined, launchedAt)).toEqual({
    lane: 'attention',
    attention: 'blocked'
  })
})

it('flags a running task whose agent stopped, waits, or cannot be seen', () => {
  const running = task('running', {})
  const later = launchedAt + 10 * 60 * 1000
  expect(portfolioTaskLane(running, status('working'), later).lane).toBe('running')
  expect(portfolioTaskLane(running, status('done'), later).attention).toBe('agent-stopped')
  expect(portfolioTaskLane(running, status('waiting'), later).attention).toBe('agent-needs-input')
  expect(portfolioTaskLane(running, status('blocked'), later).attention).toBe('agent-needs-input')
  expect(portfolioTaskLane(running, undefined, launchedAt + 1000).lane).toBe('running')
  expect(portfolioTaskLane(running, undefined, later).attention).toBe('agent-unseen')
  expect(
    portfolioTaskLane(task('running', { state: 'unknown' }), status('working'), later).attention
  ).toBe('launch-uncertain')
})

it('ignores status left in the pane by an earlier session', () => {
  const running = task('running', {})
  expect(portfolioTaskObservation(running, { a: status('done', launchedAt - 1) })).toBeUndefined()
  expect(portfolioTaskObservation(running, { a: status('working') })?.state).toBe('working')
  expect(
    portfolioTaskObservation(running, { a: { ...status('working'), restoredUnconfirmed: true } })
  ).toBeUndefined()
})
