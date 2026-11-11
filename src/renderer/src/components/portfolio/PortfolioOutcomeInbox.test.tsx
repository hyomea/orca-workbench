// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from '../../../../shared/portfolio'
import { PortfolioOutcomeInbox } from './PortfolioOutcomeInbox'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values: Record<string, string> = {}) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ''))
}))
// Checklist changes are relayed to open agent sessions; none are open here.
vi.mock('./portfolio-task-review-actions', () => ({ relayToPortfolioTask: async () => '' }))
afterEach(cleanup)

function state(): PortfolioState {
  const next = emptyPortfolio()
  const apply = (command: unknown, id: string) =>
    applyPortfolioCommand(next, PortfolioCommand.parse(command), id, 1)
  apply({ kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: [] } }, 'p')
  apply(
    {
      kind: 'role.create',
      role: {
        name: 'Android Engineer',
        agentName: 'Kiki',
        agent: 'claude',
        responsibility: 'Build'
      }
    },
    'kiki'
  )
  apply(
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'p',
        kind: 'engineering',
        title: 'Upload signatures',
        description: '',
        acceptanceCriteria: '- No error shown',
        designReferences: '',
        tickets: [],
        parity: false
      }
    },
    'o'
  )
  apply(
    {
      kind: 'task.create',
      task: {
        projectId: 'p',
        workItemId: 'o',
        roleId: 'kiki',
        platform: 'android',
        title: 'Android development',
        instructions: 'Build',
        acceptanceCriteria: 'Done'
      }
    },
    't'
  )
  apply(
    {
      kind: 'workItem.report',
      workItemId: 'o',
      report: { body: 'Rebase before the PR?', taskId: 't' }
    },
    'q'
  )
  apply(
    {
      kind: 'noteDraft.submit',
      draft: {
        projectId: 'p',
        taskId: 't',
        title: 'Analytics spec',
        body: 'Events',
        reason: 'Drop the snackbar copy'
      }
    },
    'n'
  )
  return next
}

it('shows an agent’s question and its note proposal where the outcome is, with what to do next', () => {
  const current = state()
  const onSave = vi.fn(async () => true)
  const onReviewNote = vi.fn()
  render(
    <PortfolioOutcomeInbox
      state={current}
      item={current.workItems[0]}
      busy={false}
      onSave={onSave}
      onReviewNote={onReviewNote}
    />
  )
  expect(screen.getByText('Inbox · 2 to review')).toBeTruthy()
  expect(screen.getByText('Question from Kiki · Android development')).toBeTruthy()
  expect(screen.getByText('Rebase before the PR?')).toBeTruthy()
  expect(screen.getByText('New note proposed by Kiki · Android development')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Review note' }))
  expect(onReviewNote).toHaveBeenCalledWith('n')
  fireEvent.click(screen.getByRole('button', { name: 'Mark answered' }))
  expect(onSave).toHaveBeenCalledWith({
    kind: 'workItem.resolveReport',
    workItemId: 'o',
    reportId: 'q'
  })
})
