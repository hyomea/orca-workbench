// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PortfolioTask } from '../../../../shared/portfolio'
import { PortfolioTaskDetail } from './PortfolioTaskDetail'

vi.mock('@/i18n/i18n', () => ({
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? ''))
}))
afterEach(cleanup)

const task: PortfolioTask = {
  id: 't1',
  projectId: 'p',
  roleId: 'r',
  title: 'Port the foundation',
  instructions: 'Port',
  acceptanceCriteria: 'Tests pass',
  status: 'running',
  evidence: '',
  history: [],
  attempts: [
    {
      operationId: 'op',
      worktreeId: 'w',
      agent: 'claude',
      prompt: 'Task',
      createdAt: 1,
      state: 'launched'
    }
  ]
}

function renderDetail(overrides: Partial<React.ComponentProps<typeof PortfolioTaskDetail>> = {}): {
  onSave: ReturnType<typeof vi.fn>
} {
  const onSave = vi.fn(async () => true)
  render(
    <PortfolioTaskDetail
      task={task}
      roleName="Android Engineer"
      workspaces={[]}
      busy={false}
      saveError=""
      onClose={() => {}}
      onSave={onSave}
      onLaunch={async () => true}
      onOpenWorkspace={() => {}}
      {...overrides}
    />
  )
  return { onSave }
}

it('tells the user the agent stopped and offers to end the execution there', async () => {
  const { onSave } = renderDetail()
  expect(
    within(screen.getByRole('region', { name: 'Next step' })).getByText(
      /stopped without submitting a result.*ask it in its workspace to submit/
    )
  ).toBeTruthy()
  const end = screen.getByRole('button', { name: 'End this execution' })
  expect(end.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    fireEvent.change(screen.getByLabelText('What you checked'), {
      target: { value: 'Agent exited at the permission prompt' }
    })
  })
  await act(async () => {
    fireEvent.click(end)
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.closeExecution',
    taskId: 't1',
    note: 'Agent exited at the permission prompt'
  })
})

const submitted: PortfolioTask = { ...task, status: 'review', evidence: '**Tests pass**' }

it('requires a recorded code review choice before accepting', async () => {
  const onReviewChanges = vi.fn()
  const { onSave } = renderDetail({ task: submitted, onReviewChanges })
  const accept = screen.getByRole('button', { name: 'Accept result' })
  expect(accept.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Skip code review' }))
  })
  await act(async () => {
    fireEvent.click(accept)
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.transition',
    taskId: 't1',
    status: 'accepted',
    note: 'Accepted',
    codeReview: 'skipped'
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
  })
  expect(onReviewChanges).toHaveBeenCalledWith('w')
})

it('counts existing diff comments as a code review', () => {
  renderDetail({ task: submitted, reviewComments: { total: 3, unsent: 1 } })
  expect(screen.getByText('3 comments · 1 not sent to the agent')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'I reviewed the code' }).getAttribute('aria-pressed')
  ).toBe('true')
  expect(screen.getByRole('button', { name: 'Accept result' }).hasAttribute('disabled')).toBe(false)
})

it('shows which commit was submitted for review', () => {
  renderDetail({
    task: {
      ...submitted,
      history: [{ id: 'h', at: 2, status: 'review', note: 'Done', commit: 'f3867912aa77' }]
    }
  })
  expect(screen.getByText('Submitted at commit f3867912aa')).toBeTruthy()
})
