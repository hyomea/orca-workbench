import { expect, it } from 'vitest'
import { applyPortfolioCommand, emptyPortfolio } from './portfolio'
import {
  PORTFOLIO_OUTCOME_COORDINATOR,
  portfolioRoleLabelById,
  portfolioWorkingRoles
} from './portfolio-roles'

const reviewer = { name: 'Reviewer', responsibility: 'Review changes', agent: 'codex' } as const

it('edits a role and refuses an edit made against an older version', () => {
  const state = emptyPortfolio()
  applyPortfolioCommand(state, { kind: 'role.create', role: reviewer }, 'r1', 1)
  const changed = { ...reviewer, responsibility: 'Review changes against the criteria' }
  applyPortfolioCommand(
    state,
    {
      kind: 'role.update',
      roleId: 'r1',
      role: { ...changed, agent: 'claude' },
      expected: reviewer
    },
    'unused',
    2
  )
  expect(state.roles).toEqual([{ id: 'r1', ...changed, agent: 'claude' }])
  expect(() =>
    applyPortfolioCommand(
      state,
      { kind: 'role.update', roleId: 'r1', role: reviewer, expected: reviewer },
      'unused',
      3
    )
  ).toThrow('Role changed')
  expect(() =>
    applyPortfolioCommand(
      state,
      { kind: 'role.update', roleId: 'missing', role: reviewer, expected: reviewer },
      'unused',
      4
    )
  ).toThrow('Role no longer exists')
})

it('names the role’s agent in labels and lets the user clear the name', () => {
  const state = emptyPortfolio()
  const named = { ...reviewer, agentName: 'Nova' }
  applyPortfolioCommand(state, { kind: 'role.create', role: named }, 'r1', 1)
  expect(portfolioRoleLabelById(state, 'r1')).toBe('Nova · Reviewer')
  applyPortfolioCommand(
    state,
    { kind: 'role.update', roleId: 'r1', role: reviewer, expected: named },
    'unused',
    2
  )
  expect(state.roles[0]).not.toHaveProperty('agentName')
  expect(portfolioRoleLabelById(state, 'r1')).toBe('Reviewer')
})

it('keeps the outcome coordinator out of tasks, and its role fixed through edits', () => {
  const state = emptyPortfolio()
  applyPortfolioCommand(state, { kind: 'role.create', role: PORTFOLIO_OUTCOME_COORDINATOR }, 'c', 1)
  applyPortfolioCommand(state, { kind: 'role.create', role: reviewer }, 'r1', 1)
  applyPortfolioCommand(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: [] } },
    'p',
    1
  )
  const task = {
    projectId: 'p',
    title: 'Review',
    instructions: 'Review it',
    acceptanceCriteria: 'Reviewed',
    stage: 'development'
  } as const
  expect(() =>
    applyPortfolioCommand(state, { kind: 'task.create', task: { ...task, roleId: 'c' } }, 't', 2)
  ).toThrow('assign the task to a working role')
  applyPortfolioCommand(state, { kind: 'task.create', task: { ...task, roleId: 'r1' } }, 't', 2)
  expect(portfolioWorkingRoles(state).map((role) => role.id)).toEqual(['r1'])
  // Renaming the coordinator, or sending the flag on a working role, changes neither kind.
  const { coordinator: _coordinator, ...details } = PORTFOLIO_OUTCOME_COORDINATOR
  applyPortfolioCommand(
    state,
    {
      kind: 'role.update',
      roleId: 'c',
      role: { ...details, agentName: 'Mimi' },
      expected: PORTFOLIO_OUTCOME_COORDINATOR
    },
    'unused',
    3
  )
  applyPortfolioCommand(
    state,
    {
      kind: 'role.update',
      roleId: 'r1',
      role: { ...reviewer, coordinator: true },
      expected: reviewer
    },
    'unused',
    3
  )
  expect(state.roles.map((role) => [role.id, role.agentName, role.coordinator])).toEqual([
    ['c', 'Mimi', true],
    ['r1', undefined, undefined]
  ])
})
