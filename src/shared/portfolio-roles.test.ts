import { expect, it } from 'vitest'
import { applyPortfolioCommand, emptyPortfolio } from './portfolio'
import { portfolioRoleLabelById } from './portfolio-roles'

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
