// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyPortfolio } from '../../../../shared/portfolio'
import { PortfolioComposer } from './PortfolioComposer'

vi.mock('@/i18n/i18n', () => ({
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string) => fallback
}))
afterEach(cleanup)

it('edits an existing role against the version the user opened', async () => {
  const role = {
    id: 'r1',
    name: 'Android Engineer',
    responsibility: 'Implement Android changes',
    agent: 'claude' as const
  }
  const onSave = vi.fn(async () => true)
  render(
    <PortfolioComposer
      kind="role"
      role={role}
      state={{ ...emptyPortfolio(), roles: [role] }}
      projectId="p"
      busy={false}
      saveError=""
      onSave={onSave}
      onClose={() => {}}
    />
  )
  expect(screen.getByText('Edit role')).toBeTruthy()
  expect(screen.queryByText('Apply template')).toBeNull()
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Agent name (optional)'), {
      target: { value: 'Nova' }
    })
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'role.update',
    roleId: 'r1',
    role: {
      name: 'Android Engineer',
      responsibility: 'Implement Android changes',
      agent: 'claude',
      agentName: 'Nova'
    },
    expected: { name: role.name, responsibility: role.responsibility, agent: role.agent }
  })
})
