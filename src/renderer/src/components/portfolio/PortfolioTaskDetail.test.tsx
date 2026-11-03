// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PortfolioTask } from '../../../../shared/portfolio'
import { PortfolioTaskDetail } from './PortfolioTaskDetail'

vi.mock('@/i18n/i18n', () => ({
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string) => fallback
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

it('offers to end an unobserved execution next to its status', async () => {
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
    />
  )
  expect(screen.getByText(/If the agent exited or never started/)).toBeTruthy()
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
