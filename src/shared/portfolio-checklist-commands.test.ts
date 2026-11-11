import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from './portfolio'
import { portfolioChecklist, portfolioChecklistChanges } from './portfolio-checklist'

function apply(state: PortfolioState, command: unknown, id = 'change', now = 1): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, now)
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
  for (const [id, title] of [
    ['outcome', 'Upload signatures'],
    ['other', 'Refunds']
  ]) {
    apply(
      state,
      {
        kind: 'workItem.create',
        workItem: {
          projectId: 'project',
          kind: 'engineering',
          title,
          description: '',
          acceptanceCriteria: '- A failed upload shows an error with retry',
          designReferences: '',
          tickets: [],
          parity: false
        }
      },
      id
    )
  }
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'other',
        roleId: 'role',
        title: 'Refunds development',
        instructions: 'Build it',
        acceptanceCriteria: 'Done'
      }
    },
    'refunds-task'
  )
  return state
}

const outcome = (state: PortfolioState) => state.workItems[0]

it('changes the checklist only when the user accepts a proposal, as they reworded it', () => {
  const state = fixture()
  const [criterion] = portfolioChecklist(outcome(state))
  apply(
    state,
    {
      kind: 'workItem.proposeChecklist',
      workItemId: 'outcome',
      proposal: {
        kind: 'criterion',
        itemId: criterion.id,
        text: 'A failed upload shows an error; no retry',
        reason: 'Agreed with the user'
      }
    },
    'p1',
    2
  )
  apply(
    state,
    {
      kind: 'workItem.proposeChecklist',
      workItemId: 'outcome',
      proposal: { kind: 'decision', text: 'Track upload_failed', reason: '' }
    },
    'p2',
    3
  )
  // Proposing alone leaves the checklist as it was.
  expect(portfolioChecklist(outcome(state))).toEqual([criterion])
  const before = portfolioChecklist(outcome(state))
  apply(
    state,
    {
      kind: 'workItem.acceptProposal',
      workItemId: 'outcome',
      proposalId: 'p1',
      item: {
        kind: 'criterion',
        text: 'A failed upload shows an error without retry',
        note: 'Kiki'
      }
    },
    'accept',
    4
  )
  const item = outcome(state)
  expect(item.checklist?.[0]).toMatchObject({
    id: criterion.id,
    text: 'A failed upload shows an error without retry',
    note: 'Kiki'
  })
  expect(item.acceptanceCriteria).toBe('- A failed upload shows an error without retry')
  expect(item.proposals?.map((entry) => entry.id)).toEqual(['p2'])
  expect(portfolioChecklistChanges(before, item.checklist ?? [])).toEqual([
    'Changed criterion "A failed upload shows an error with retry" to criterion: A failed upload shows an error without retry'
  ])
  apply(state, { kind: 'workItem.dismissProposal', workItemId: 'outcome', proposalId: 'p2' })
  expect(outcome(state).proposals).toBeUndefined()
  expect(outcome(state).checklist).toHaveLength(1)
  expect(() =>
    apply(state, { kind: 'workItem.dismissProposal', workItemId: 'outcome', proposalId: 'p2' })
  ).toThrow('already handled')
})

it('rejects a proposal from another outcome’s task or for an item that does not exist', () => {
  const state = fixture()
  const propose = (proposal: object) =>
    apply(state, {
      kind: 'workItem.proposeChecklist',
      workItemId: 'outcome',
      proposal: { kind: 'decision', text: 'X', reason: '', ...proposal }
    })
  expect(() => propose({ taskId: 'refunds-task' })).toThrow('does not belong to this outcome')
  expect(() => propose({ itemId: 'missing' })).toThrow('does not exist')
})

it('holds sign-off until every proposal is handled, and closes the inbox once signed off', () => {
  const state = fixture()
  apply(
    state,
    {
      kind: 'workItem.proposeChecklist',
      workItemId: 'outcome',
      proposal: { kind: 'decision', text: 'No retry', reason: '' }
    },
    'p1'
  )
  const signOff = () =>
    apply(state, {
      kind: 'workItem.transition',
      workItemId: 'outcome',
      status: 'accepted',
      note: 'Done'
    })
  expect(signOff).toThrow('proposed checklist changes')
  apply(state, { kind: 'workItem.dismissProposal', workItemId: 'outcome', proposalId: 'p1' })
  signOff()
  expect(() =>
    apply(state, {
      kind: 'workItem.proposeChecklist',
      workItemId: 'outcome',
      proposal: { kind: 'decision', text: 'Late', reason: '' }
    })
  ).toThrow('Reopen the outcome')
})

it('describes added and removed items for the open sessions', () => {
  const at = 0
  expect(
    portfolioChecklistChanges(
      [
        { id: 'a', kind: 'criterion', text: 'Keep', at },
        { id: 'b', kind: 'criterion', text: 'Drop', at }
      ],
      [
        { id: 'a', kind: 'criterion', text: 'Keep', note: 'only the note changed', at },
        { id: 'c', kind: 'decision', text: 'No retry', at }
      ]
    )
  ).toEqual(['Added decision: No retry', 'Removed criterion: Drop'])
})
