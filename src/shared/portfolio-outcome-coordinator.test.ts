import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from './portfolio'
import { PORTFOLIO_OUTCOME_COORDINATOR } from './portfolio-roles'

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
  apply(state, { kind: 'role.create', role: PORTFOLIO_OUTCOME_COORDINATOR }, 'coordinator')
  apply(
    state,
    { kind: 'role.create', role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' } },
    'engineer'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'engineering',
        title: 'Refunds',
        description: '',
        acceptanceCriteria: '- Works',
        designReferences: '',
        tickets: [],
        parity: false
      }
    },
    'outcome'
  )
  return state
}

it('hands an outcome to the coordinator role only, and back to the workbench coordinator', () => {
  const state = fixture()
  const handOff = (roleId: string) =>
    apply(state, { kind: 'workItem.handOff', workItemId: 'outcome', roleId, path: '/c/refunds' })
  expect(() => handOff('engineer')).toThrow('Choose the Outcome coordinator role')
  handOff('coordinator')
  expect(state.workItems[0].coordinator).toEqual({
    roleId: 'coordinator',
    path: '/c/refunds',
    at: 1
  })
  apply(state, { kind: 'workItem.handBack', workItemId: 'outcome' })
  expect(state.workItems[0].coordinator).toBeUndefined()
  expect(state.workItems[0].history.map((entry) => entry.note).slice(-2)).toEqual([
    'Handed over to Outcome coordinator',
    'Handed back to the workbench coordinator'
  ])
  expect(() => apply(state, { kind: 'workItem.handBack', workItemId: 'outcome' })).toThrow(
    'no coordinator'
  )
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'outcome',
    status: 'accepted',
    note: 'Done'
  })
  expect(() => handOff('coordinator')).toThrow('signed-off outcome')
})
