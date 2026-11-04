import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from '../../../../shared/portfolio'
import { portfolioTracks } from './portfolio-tracks'

function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: ['r'] } },
    'project'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' } },
    'role'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'improvement',
        title: 'Multiple check-ins',
        description: 'Check in several showtimes',
        acceptanceCriteria: 'Works',
        designReferences: '',
        tickets: [
          { platform: 'ios', reference: 'ENG-1' },
          { platform: 'android', reference: 'ENG-2' },
          { platform: 'backend', reference: 'ENG-3' }
        ],
        parity: true
      }
    },
    'outcome'
  )
  for (const stage of ['development', 'codeReview', 'qa'] as const) {
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          roleId: 'role',
          platform: 'android',
          stage,
          title: `Android ${stage}`,
          instructions: 'Work',
          acceptanceCriteria: 'Done'
        }
      },
      stage
    )
  }
  return state
}

function tracks(state: PortfolioState) {
  return portfolioTracks(state, 'project', {}, 10)
}

it('shows one row per platform, with another team’s backend ticket as external', () => {
  const rows = tracks(fixture())
  expect(rows.map((row) => [row.platform, row.current, row.next])).toEqual([
    ['android', 'development', 'start'],
    ['ios', 'development', 'plan'],
    ['backend', 'external', 'none']
  ])
  expect(rows[2].ticket).toBe('ENG-3')
})

it('moves the current stage forward as each stage is submitted and accepted', () => {
  const state = fixture()
  const android = () => tracks(state).find((row) => row.platform === 'android')!
  preparePortfolioAttempt(state, 'development', 'w', 'r', 'op', 1).state = 'launched'
  expect(android()).toMatchObject({ current: 'development', next: 'agent' })
  apply(state, { kind: 'task.transition', taskId: 'development', status: 'review', note: 'Done' })
  expect(android()).toMatchObject({ current: 'codeReview', next: 'start' })
  preparePortfolioAttempt(state, 'codeReview', 'w', 'r', 'op2', 2).state = 'launched'
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'review', note: 'Pass' })
  expect(android()).toMatchObject({ current: 'codeReview', next: 'decide' })
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'OK' })
  apply(state, { kind: 'task.delete', taskId: 'qa' })
  // Without a QA task, the user's last decision is accepting development itself.
  expect(android()).toMatchObject({ current: 'development', next: 'decide' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'accepted',
    note: 'OK',
    codeReview: 'skipped'
  })
  expect(android()).toMatchObject({ current: 'done', next: 'none' })
})

it('lists tasks outside an outcome as their own rows', () => {
  const state = fixture()
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        roleId: 'role',
        title: 'Spike',
        instructions: 'Try',
        acceptanceCriteria: 'Notes'
      }
    },
    'spike'
  )
  expect(tracks(state).find((row) => row.key === 'spike')).toMatchObject({
    title: 'Spike',
    current: 'development',
    next: 'start'
  })
  expect(portfolioTracks(state, 'other', {}, 10)).toEqual([])
})
