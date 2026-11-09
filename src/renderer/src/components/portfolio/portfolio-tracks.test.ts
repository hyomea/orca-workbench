import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  parsePortfolioState,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from '../../../../shared/portfolio'
import { portfolioOutcomePhase } from './portfolio-outcome-phase'
import { portfolioTracks } from './portfolio-tracks'
import type { PortfolioPrStatus } from './portfolio-track-pr'

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
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'review',
    note: 'Done',
    commit: 'abc1234'
  })
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

it('shows a team initiative’s PR under code review, then waits in done until it merges', () => {
  const state = fixture()
  const android = (status?: PortfolioPrStatus) =>
    portfolioTracks(state, 'project', {}, 10, (worktreeId) =>
      status ? { worktreeId, status, number: 7 } : undefined
    ).find((row) => row.platform === 'android')!
  preparePortfolioAttempt(state, 'development', 'w', 'r', 'op', 1).state = 'launched'
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'review',
    note: 'Done',
    commit: 'abc1234'
  })
  // A personal initiative never looks for a PR.
  expect(android('inReview')).not.toHaveProperty('pr')
  apply(state, { kind: 'project.reviewMode', projectId: 'project', mode: 'team' })
  expect(android('inReview')).toMatchObject({
    current: 'codeReview',
    next: 'start',
    pr: { worktreeId: 'w', number: 7 }
  })
  apply(state, { kind: 'task.delete', taskId: 'codeReview' })
  apply(state, { kind: 'task.delete', taskId: 'qa' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'accepted',
    note: 'OK',
    codeReview: 'reviewed'
  })
  expect(android('inReview')).toMatchObject({ current: 'merge', next: 'waiting' })
  expect(android('readyToMerge')).toMatchObject({ current: 'merge', next: 'decide' })
  expect(android('ciFailing')).toMatchObject({ current: 'merge', next: 'attention' })
  expect(android('merged')).toMatchObject({ current: 'done', next: 'none' })
  // A removed workspace can no longer be followed, so the track counts as done.
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

it('follows a teammate’s PR the user reviews: review, QA, new commits, then merge', () => {
  const state = fixture()
  apply(state, { kind: 'project.reviewMode', projectId: 'project', mode: 'team' })
  const pr = 'https://github.com/ludus/ios-box-office/pull/9'
  apply(state, {
    kind: 'workItem.scope',
    workItemId: 'outcome',
    tickets: [
      { platform: 'ios', reference: 'ENG-1', role: 'reviewer', pr },
      { platform: 'android', reference: 'ENG-2' },
      { platform: 'backend', reference: '', role: 'tracking', pr }
    ],
    parity: true
  })
  let head = 'abc1234ffff'
  let status: PortfolioPrStatus = 'inReview'
  const row = (platform: string) =>
    portfolioTracks(state, 'project', {}, 10, (worktreeId) => ({
      worktreeId,
      status,
      headSha: head
    })).find((entry) => entry.platform === platform)!
  expect(row('backend')).toMatchObject({ role: 'tracking', current: 'external', next: 'none' })
  expect(row('ios')).toMatchObject({ role: 'reviewer', prLink: pr, current: 'codeReview' })
  expect(row('ios').next).toBe('plan')
  for (const stage of ['codeReview', 'qa'] as const) {
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          roleId: 'role',
          platform: 'ios',
          stage,
          title: `iOS ${stage}`,
          instructions: 'Check',
          acceptanceCriteria: 'Done'
        }
      },
      `ios-${stage}`
    )
  }
  expect(row('ios')).toMatchObject({ current: 'codeReview', next: 'start' })
  preparePortfolioAttempt(state, 'ios-codeReview', 'pr-9', 'r', 'op', 1).state = 'launched'
  apply(state, {
    kind: 'task.transition',
    taskId: 'ios-codeReview',
    status: 'review',
    note: 'Comments',
    commit: 'abc1234'
  })
  expect(row('ios')).toMatchObject({
    current: 'codeReview',
    next: 'decide',
    pr: { worktreeId: 'pr-9' }
  })
  expect(row('ios')).not.toHaveProperty('newCommits')
  apply(state, {
    kind: 'task.transition',
    taskId: 'ios-codeReview',
    status: 'accepted',
    note: 'OK'
  })
  expect(row('ios')).toMatchObject({ current: 'qa', next: 'start' })
  preparePortfolioAttempt(state, 'ios-qa', 'pr-9', 'r', 'op-qa', 2).state = 'launched'
  apply(state, { kind: 'task.transition', taskId: 'ios-qa', status: 'review', note: 'Pass' })
  apply(state, { kind: 'task.transition', taskId: 'ios-qa', status: 'accepted', note: 'OK' })
  expect(row('ios')).toMatchObject({ current: 'merge', next: 'waiting' })
  // The author pushed again: the user decides whether to review another round.
  head = 'def5678aaaa'
  expect(row('ios')).toMatchObject({ current: 'codeReview', next: 'decide', newCommits: true })
  head = 'abc1234ffff'
  status = 'merged'
  expect(row('ios')).toMatchObject({ current: 'done', next: 'none' })
})

it('takes an outcome’s phase from its tasks, not from a status set by hand', () => {
  const stored = fixture()
  // Saved before sign-off was the only stored decision: the outcome was moved to review by hand.
  const raw = JSON.parse(JSON.stringify(stored))
  raw.workItems[0].status = 'review'
  raw.workItems[0].tickets = [{ platform: 'android', reference: 'ENG-2' }]
  raw.workItems[0].parity = false
  const state = parsePortfolioState(raw)
  expect(state.workItems[0].status).toBe('planned')
  // Development and QA accepted; the code review waits for the user's decision.
  for (const task of state.tasks) {
    task.status = task.stage === 'codeReview' ? 'review' : 'accepted'
  }
  const item = state.workItems[0]
  expect(portfolioOutcomePhase(state, item, tracks(state)).phase).toBe('codeReview')
  state.tasks.find((task) => task.stage === 'codeReview')!.status = 'accepted'
  expect(portfolioOutcomePhase(state, item, tracks(state)).phase).toBe('signOff')
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'outcome',
    status: 'accepted',
    note: 'OK'
  })
  expect(portfolioOutcomePhase(state, item, tracks(state)).phase).toBe('signedOff')
  expect(() =>
    PortfolioCommand.parse({
      kind: 'workItem.transition',
      workItemId: 'outcome',
      status: 'review',
      note: 'Ready'
    })
  ).toThrow()
})
