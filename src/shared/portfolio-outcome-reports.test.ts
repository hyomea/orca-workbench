import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from './portfolio'
import { portfolioOutcomeInboxCount, portfolioOutcomeNoteDrafts } from './portfolio-outcome-reports'

function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: [] } },
    'project'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' } },
    'role'
  )
  for (const id of ['signatures', 'refunds']) {
    apply(
      state,
      {
        kind: 'workItem.create',
        workItem: {
          projectId: 'project',
          kind: 'engineering',
          title: id,
          description: '',
          acceptanceCriteria: '- Works',
          designReferences: '',
          tickets: [],
          parity: false
        }
      },
      id
    )
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: id,
          roleId: 'role',
          platform: 'android',
          title: `${id} development`,
          instructions: 'Build it',
          acceptanceCriteria: 'Done'
        }
      },
      `${id}-task`
    )
  }
  return state
}

it('keeps an agent’s question in its outcome’s inbox until it is answered', () => {
  const state = fixture()
  apply(
    state,
    {
      kind: 'workItem.report',
      workItemId: 'signatures',
      report: { body: 'origin/development moved 7 commits; rebase?', taskId: 'signatures-task' }
    },
    'q1'
  )
  expect(() =>
    apply(state, {
      kind: 'workItem.report',
      workItemId: 'signatures',
      report: { body: 'Wrong outcome', taskId: 'refunds-task' }
    })
  ).toThrow('does not belong to this outcome')
  expect(portfolioOutcomeInboxCount(state, 'signatures')).toBe(1)
  apply(state, {
    kind: 'workItem.resolveReport',
    workItemId: 'signatures',
    reportId: 'q1',
    note: 'Rebase after code review'
  })
  const item = state.workItems[0]
  expect(item.reports).toBeUndefined()
  expect(item.history.at(-1)?.note).toBe(
    'Resolved a question from signatures development: Rebase after code review'
  )
})

it('files a task’s note proposal under the task’s outcome, so its inbox shows it', () => {
  const state = fixture()
  const draft = {
    projectId: 'project',
    title: 'Analytics spec',
    body: 'Events',
    reason: 'Decision'
  }
  apply(state, { kind: 'noteDraft.submit', draft: { ...draft, taskId: 'signatures-task' } }, 'n1')
  apply(state, { kind: 'noteDraft.submit', draft: { ...draft, workItemId: 'refunds' } }, 'n2')
  apply(state, { kind: 'noteDraft.submit', draft }, 'n3')
  expect(state.noteDrafts.map((entry) => [entry.id, entry.workItemId])).toEqual([
    ['n1', 'signatures'],
    ['n2', 'refunds'],
    ['n3', undefined]
  ])
  expect(portfolioOutcomeNoteDrafts(state, 'signatures').map((entry) => entry.id)).toEqual(['n1'])
  expect(() =>
    apply(state, { kind: 'noteDraft.submit', draft: { ...draft, workItemId: 'missing' } })
  ).toThrow('does not belong to this initiative')
})
