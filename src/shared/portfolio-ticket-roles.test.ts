import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from './portfolio'
import type { PortfolioTicket } from './portfolio-features'
import { portfolioStageBlocker } from './portfolio-task-stages'

const PR = 'https://github.com/ludus/android-box-office/pull/281'

function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}

// The user builds iOS and reviews a teammate's Android PR.
function fixture(android: PortfolioTicket): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    {
      kind: 'project.create',
      project: { name: 'Mobile', objective: 'Ship', repoIds: ['android'], reviewMode: 'team' }
    },
    'project'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Reviewer', agent: 'claude', responsibility: 'Check' } },
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
        description: 'Allow more than one check-in',
        acceptanceCriteria: 'A guest can check in twice',
        designReferences: '',
        tickets: [{ platform: 'ios', reference: 'ENG-1' }, android],
        parity: true
      }
    },
    'outcome'
  )
  return state
}

function createTask(state: PortfolioState, stage: string): void {
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
        title: stage,
        instructions: `Do ${stage}`,
        acceptanceCriteria: 'Done'
      }
    },
    stage
  )
}

function submit(state: PortfolioState, taskId: string, commit: string): void {
  apply(state, {
    kind: 'task.transition',
    taskId,
    status: 'review',
    note: 'Report',
    commit
  })
}

const reviewer = { platform: 'android', reference: 'ENG-2', role: 'reviewer', pr: PR } as const

it('plans only review and QA for a platform the user reviews, and none for one they track', () => {
  const state = fixture(reviewer)
  expect(() => createTask(state, 'development')).toThrow('A teammate builds this platform')
  createTask(state, 'codeReview')
  createTask(state, 'qa')
  const tracked = fixture({ platform: 'android', reference: 'ENG-2', role: 'tracking' })
  expect(() => createTask(tracked, 'codeReview')).toThrow('You only track this platform')
})

it('keeps a platform’s role consistent with the tasks it already has', () => {
  const state = fixture({ platform: 'android', reference: 'ENG-2' })
  createTask(state, 'development')
  expect(() =>
    apply(state, {
      kind: 'workItem.scope',
      workItemId: 'outcome',
      tickets: [reviewer],
      parity: true
    })
  ).toThrow('A teammate builds this platform')
})

it('reviews the teammate’s PR without development, then QA tests it for integration', () => {
  const state = fixture({ platform: 'android', reference: 'ENG-2', role: 'reviewer' })
  createTask(state, 'codeReview')
  createTask(state, 'qa')
  const review = state.tasks.find((task) => task.id === 'codeReview')!
  expect(portfolioStageBlocker(state, review)).toContain('PR link')
  apply(state, { kind: 'workItem.scope', workItemId: 'outcome', tickets: [reviewer], parity: true })
  expect(portfolioStageBlocker(state, review)).toBeUndefined()
  const qa = state.tasks.find((task) => task.id === 'qa')!
  expect(portfolioStageBlocker(state, qa)).toBe('Start QA after you accept the code review.')

  const prompt = preparePortfolioAttempt(state, 'codeReview', 'pr-281', 'android', 'op', 2).prompt
  expect(prompt).toContain(`code review of a teammate's pull request, ${PR}`)
  expect(prompt).toContain('Do not edit product code, push, or comment on')
  expect(prompt).not.toContain('Development task:')
  review.attempts.at(-1)!.state = 'launched'
  submit(state, 'codeReview', 'abc1234')

  // Findings are the user's to post; a new round reviews the author's new commits.
  expect(() => apply(state, { kind: 'task.sendBack', taskId: 'codeReview', note: 'B-1' })).toThrow(
    'post your findings on their PR'
  )
  apply(state, { kind: 'task.requestTriage', taskId: 'codeReview', note: 'New commits' })
  expect(review.status).toBe('running')
  submit(state, 'codeReview', 'def5678')
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'OK' })

  expect(portfolioStageBlocker(state, qa)).toBeUndefined()
  const qaPrompt = preparePortfolioAttempt(state, 'qa', 'pr-281', 'android', 'op-qa', 3).prompt
  expect(qaPrompt).toContain('Focus on integration')
})
