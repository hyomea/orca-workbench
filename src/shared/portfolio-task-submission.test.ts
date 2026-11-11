import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState,
  type PortfolioTask
} from './portfolio'
import {
  portfolioReviewedCommit,
  portfolioStageCommit,
  portfolioStageOutdated
} from './portfolio-track-commits'

function apply(state: PortfolioState, command: unknown, now = 1): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), 'change', now)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(state, {
    kind: 'project.create',
    project: { name: 'Mobile', objective: 'Ship', repoIds: ['ios'] }
  })
  state.projects[0].id = 'project'
  apply(state, {
    kind: 'role.create',
    role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' }
  })
  state.roles[0].id = 'role'
  apply(state, {
    kind: 'workItem.create',
    workItem: {
      projectId: 'project',
      kind: 'engineering',
      title: 'Upload signatures',
      description: '',
      acceptanceCriteria: 'No retry',
      designReferences: '',
      tickets: [{ platform: 'ios', reference: 'ENG-8250' }],
      parity: false
    }
  })
  state.workItems[0].id = 'outcome'
  for (const stage of ['development', 'codeReview'] as const) {
    apply(state, {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'outcome',
        roleId: 'role',
        platform: 'ios',
        stage,
        title: stage,
        instructions: `Do ${stage}`,
        acceptanceCriteria: 'Done'
      }
    })
    state.tasks.at(-1)!.id = stage
  }
  return state
}

const task = (state: PortfolioState, id: string): PortfolioTask =>
  state.tasks.find((entry) => entry.id === id)!

function launch(state: PortfolioState, id: string, now: number): void {
  preparePortfolioAttempt(state, id, 'branch', 'ios', `${id}-${now}`, now).state = 'launched'
}

// Development submits round 2 at 2500b07, code review starts on it, then the user asks
// development for one more change, which it commits as ca2e945 and resubmits.
function resubmitted(): PortfolioState {
  const state = fixture()
  launch(state, 'development', 2)
  apply(
    state,
    {
      kind: 'task.transition',
      taskId: 'development',
      status: 'review',
      note: 'Round 2',
      commit: '2500b078'
    },
    3
  )
  launch(state, 'codeReview', 4)
  // A push the user confirmed is an event in review, not a new submission.
  apply(state, { kind: 'task.confirmPush', taskId: 'development' }, 5)
  apply(
    state,
    {
      kind: 'task.resubmit',
      taskId: 'development',
      note: 'Removed the inline error',
      commit: 'ca2e945a'
    },
    6
  )
  return state
}

it('takes development’s newer commits while it is in review, and shows code review is behind', () => {
  const state = resubmitted()
  const development = task(state, 'development')
  expect(development.status).toBe('review')
  expect(development.evidence).toBe('Removed the inline error')
  const review = task(state, 'codeReview')
  expect(portfolioStageCommit(state, review)).toBe('ca2e945a')
  expect(portfolioReviewedCommit(state, review)).toBe('2500b078')
  expect(portfolioStageOutdated(state, review)).toEqual({
    reviewed: '2500b078',
    current: 'ca2e945a'
  })
  expect(() =>
    apply(state, {
      kind: 'task.resubmit',
      taskId: 'development',
      note: 'Again',
      commit: 'ca2e945a'
    })
  ).toThrow('already submitted')
})

it('accepts nothing that covers the older commit until code review looks at the new one', () => {
  const state = resubmitted()
  apply(state, {
    kind: 'task.transition',
    taskId: 'codeReview',
    status: 'review',
    note: 'Pass',
    commit: 'ca2e945a'
  })
  // Its report was written for 2500b078, even though the branch holds ca2e945a now.
  expect(() =>
    apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'Ok' })
  ).toThrow('looked at 2500b078, but development has since submitted ca2e945a')
  apply(state, { kind: 'task.runAgain', taskId: 'codeReview' }, 7)
  const review = task(state, 'codeReview')
  expect(review.status).toBe('running')
  expect(review.evidence).toBe('')
  expect(review.attempts.at(-1)?.commit).toBe('ca2e945a')
  expect(portfolioStageOutdated(state, review)).toBeUndefined()
  expect(() => apply(state, { kind: 'task.runAgain', taskId: 'codeReview' })).toThrow(
    'after development submits again'
  )
})

it('reads the reviewed commit of a session started before sessions recorded it', () => {
  const state = resubmitted()
  delete task(state, 'codeReview').attempts.at(-1)!.commit
  expect(portfolioReviewedCommit(state, task(state, 'codeReview'))).toBe('2500b078')
})

it('records a push the user asked for in the session, and only from development', () => {
  const state = resubmitted()
  apply(state, { kind: 'task.recordPush', taskId: 'development', commit: 'ca2e945a' }, 8)
  expect(task(state, 'development').history.at(-1)?.note).toBe(
    'Pushed the branch at ca2e945a (the user asked in the session)'
  )
  expect(() =>
    apply(state, { kind: 'task.recordPush', taskId: 'codeReview', commit: 'ca2e945a' })
  ).toThrow('Only an open development session')
  // A resubmission needs development in review, not working on findings sent back.
  apply(state, { kind: 'task.runAgain', taskId: 'codeReview' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'codeReview',
    status: 'review',
    note: 'Needs fixes',
    commit: 'ca2e945a'
  })
  apply(state, { kind: 'task.sendBack', taskId: 'codeReview', note: 'Fix the toast' })
  expect(task(state, 'development').status).toBe('running')
  expect(() =>
    apply(state, {
      kind: 'task.resubmit',
      taskId: 'development',
      note: 'More',
      commit: 'ddd11111'
    })
  ).toThrow('submit it the usual way')
})
