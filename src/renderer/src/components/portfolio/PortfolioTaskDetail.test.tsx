// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyPortfolio, type PortfolioTask } from '../../../../shared/portfolio'
import { PortfolioTaskDetail } from './PortfolioTaskDetail'
import type * as PortfolioTrackPrModule from './portfolio-track-pr'
import { useAppStore } from '@/store'
import type * as I18n from '@/i18n/i18n'

vi.mock('@/i18n/i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? ''))
}))
const sendMessageToAgent = vi.hoisted(() => vi.fn(async () => ({ status: 'sent' })))
vi.mock('@/lib/agent-session/messaging/agent-message-send', () => ({ sendMessageToAgent }))
vi.mock('./portfolio-track-pr', async (original) => ({
  ...(await original<typeof PortfolioTrackPrModule>()),
  usePortfolioPrLookup: () => (worktreeId: string) => ({
    worktreeId,
    status: 'changesRequested',
    number: 12,
    url: 'https://github.com/o/r/pull/12',
    headSha: 'def5678aaaa',
    repo: { path: '/repo', id: 'repo' }
  }),
  usePortfolioPrRefresh: () => {}
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
  stage: 'development',
  steps: [],
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
      state={{ ...emptyPortfolio(), tasks: [task] }}
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

it('sends a code review’s chosen findings back to development', async () => {
  const review: PortfolioTask = {
    ...submitted,
    id: 'review',
    workItemId: 'outcome',
    platform: 'android',
    stage: 'codeReview',
    evidence: '**B-1** missing test\n**N-1** naming'
  }
  // Development still has its agent session open, so the findings go into its pane.
  const development: PortfolioTask = {
    ...submitted,
    workItemId: 'outcome',
    platform: 'android',
    attempts: [
      {
        ...task.attempts[0],
        worktreeId: 'repo::/work/ENG-5952',
        paneKey: 'tab-1:4f5c2a1e-8b9d-4c3e-a2f1-0d9e8c7b6a50'
      }
    ]
  }
  const { onSave } = renderDetail({
    task: review,
    state: { ...emptyPortfolio(), tasks: [development, review] }
  })
  // A review's result is the check; the user's own code review choice is for development.
  expect(screen.queryByRole('button', { name: 'Skip code review' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Accept result' }).hasAttribute('disabled')).toBe(false)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start from the submitted report' }))
  })
  expect((screen.getByLabelText('Findings to send back') as HTMLTextAreaElement).value).toBe(
    review.evidence
  )
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Findings to send back'), {
      target: { value: 'B-1 missing test' }
    })
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send back to development' }))
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.sendBack',
    taskId: 'review',
    note: 'B-1 missing test'
  })
  expect(sendMessageToAgent).toHaveBeenCalledWith({
    worktreeId: 'repo::/work/ENG-5952',
    target: { kind: 'terminal', tabId: 'tab-1', leafId: '4f5c2a1e-8b9d-4c3e-a2f1-0d9e8c7b6a50' },
    prompt: expect.stringMatching(
      /from code review \(Workbench task review\)[\s\S]*B-1 missing test$/
    )
  })
})

it('tells the user to paste the findings when they cannot reach the development agent', async () => {
  sendMessageToAgent.mockResolvedValueOnce({ status: 'no-active-terminal' })
  const review: PortfolioTask = { ...submitted, id: 'review', workItemId: 'o', stage: 'qa' }
  const development: PortfolioTask = {
    ...submitted,
    workItemId: 'o',
    attempts: [{ ...task.attempts[0], paneKey: 'tab-1:4f5c2a1e-8b9d-4c3e-a2f1-0d9e8c7b6a50' }]
  }
  renderDetail({ task: review, state: { ...emptyPortfolio(), tasks: [development, review] } })
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Findings to send back'), {
      target: { value: 'Crash on rotate' }
    })
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send back to development' }))
  })
  expect(screen.getByRole('alert').textContent).toMatch(
    /^Saved, but it could not be sent to the agent: .+ Paste the message into its session\.$/
  )
})

it('explains why development cannot be accepted before its review and QA', () => {
  const review: PortfolioTask = {
    ...task,
    id: 'review',
    workItemId: 'outcome',
    stage: 'codeReview',
    status: 'todo',
    attempts: []
  }
  const development: PortfolioTask = { ...submitted, workItemId: 'outcome' }
  renderDetail({
    task: development,
    state: { ...emptyPortfolio(), tasks: [development, review] }
  })
  expect(screen.getByText(/Code review and QA run next from the Tasks page/)).toBeTruthy()
  expect(screen.getByText('Accept the code review before accepting development.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Accept result' }).hasAttribute('disabled')).toBe(true)
})

it('shows the development steps and why a later stage cannot start yet', () => {
  const development: PortfolioTask = {
    ...task,
    workItemId: 'outcome',
    steps: [
      { id: 'S1', title: 'Data layer', done: true, commit: 'abc1234def9' },
      { id: 'S2', title: 'UI', done: false }
    ]
  }
  renderDetail({ task: development, state: { ...emptyPortfolio(), tasks: [development] } })
  expect(screen.getByText('Steps (1 of 2 done)')).toBeTruthy()
  expect(screen.getByText('abc1234def')).toBeTruthy()
  cleanup()
  const qa: PortfolioTask = {
    ...task,
    id: 'qa',
    workItemId: 'outcome',
    stage: 'qa',
    status: 'todo',
    attempts: []
  }
  renderDetail({
    task: qa,
    state: { ...emptyPortfolio(), tasks: [development, qa] },
    workspaces: [{ id: 'w', repoId: 'r', name: 'ENG-5952' }]
  })
  expect(screen.getByText('Start this after development submits its work.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Start agent' }).hasAttribute('disabled')).toBe(true)
})

it('asks a team code review to triage the PR comments posted since it last submitted', async () => {
  const review: PortfolioTask = {
    ...task,
    id: 'review',
    workItemId: 'outcome',
    platform: 'android',
    stage: 'codeReview',
    status: 'review',
    history: [
      { id: 'review:0', at: Date.parse('2026-11-05T10:00:00Z'), status: 'review', note: 'Pass' }
    ],
    attempts: [{ ...task.attempts[0], paneKey: 'tab-1:4f5c2a1e-8b9d-4c3e-a2f1-0d9e8c7b6a50' }]
  }
  const development: PortfolioTask = { ...task, workItemId: 'outcome', platform: 'android' }
  const state = {
    ...emptyPortfolio(),
    projects: [
      { id: 'p', name: 'Mobile', objective: 'Ship', repoIds: [], reviewMode: 'team' as const }
    ],
    tasks: [development, review]
  }
  const fetchPRComments = vi.fn(async () => [
    comment(1, '2026-11-05T09:00:00Z', 'Already reviewed'),
    comment(2, '2026-11-05T11:00:00Z', 'Rename this helper')
  ])
  useAppStore.setState({ fetchPRComments })
  sendMessageToAgent.mockClear()
  const { onSave } = renderDetail({ state, task: review })
  const pr = screen.getByRole('region', { name: 'Pull request' })
  expect(within(pr).getByText('Pull request #12')).toBeTruthy()
  expect(within(pr).getByText('Changes requested')).toBeTruthy()
  expect(await within(pr).findByText('New PR comments since the last review: 1')).toBeTruthy()
  await act(async () => {
    fireEvent.click(within(pr).getByRole('button', { name: 'Ask the reviewer to triage them' }))
  })
  expect(fetchPRComments).toHaveBeenCalledWith('/repo', 12, { repoId: 'repo', prRepo: null })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.requestTriage',
    taskId: 'review',
    note: '- octo on src/A.kt:4: Rename this helper\n  https://github.com/o/r/pull/12#2'
  })
  expect(sendMessageToAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      prompt: expect.stringMatching(/triage new PR review comments for your Workbench task review/)
    })
  )
})

it('lets the user post a teammate PR review themselves and review the author’s new commits', async () => {
  const review: PortfolioTask = {
    ...task,
    id: 'review',
    workItemId: 'outcome',
    platform: 'ios',
    stage: 'codeReview',
    status: 'review',
    evidence: 'B-1: missing nil check',
    history: [{ id: 'review:0', at: 1, status: 'review', note: 'Report', commit: 'abc1234' }]
  }
  const state = {
    ...emptyPortfolio(),
    projects: [
      { id: 'p', name: 'Mobile', objective: 'Ship', repoIds: [], reviewMode: 'team' as const }
    ],
    workItems: [
      {
        id: 'outcome',
        projectId: 'p',
        kind: 'improvement' as const,
        title: 'Check-ins',
        description: '',
        acceptanceCriteria: 'Works',
        designReferences: '',
        tickets: [
          {
            platform: 'ios' as const,
            reference: 'ENG-1',
            role: 'reviewer' as const,
            pr: 'https://github.com/o/r/pull/12'
          }
        ],
        parity: false,
        baseVersion: 0,
        status: 'active' as const,
        history: []
      }
    ],
    tasks: [review]
  }
  useAppStore.setState({ fetchPRComments: vi.fn(async () => []) })
  const { onSave } = renderDetail({ state, task: review })
  expect(screen.queryByRole('button', { name: 'Send back to development' })).toBeNull()
  expect(screen.getByText(/Post the comments you agree with on the PR yourself/)).toBeTruthy()
  const pr = screen.getByRole('region', { name: 'Pull request' })
  expect(within(pr).getByText('New commits since your review')).toBeTruthy()
  await act(async () => {
    fireEvent.click(within(pr).getByRole('button', { name: 'Review the new commits' }))
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.requestTriage',
    taskId: 'review',
    note: expect.stringMatching(/review at abc1234; the PR is now at def5678aaa/)
  })
})

function comment(id: number, createdAt: string, body: string) {
  return {
    id,
    author: 'octo',
    authorAvatarUrl: '',
    body,
    createdAt,
    url: `https://github.com/o/r/pull/12#${id}`,
    path: 'src/A.kt',
    line: 4
  }
}
