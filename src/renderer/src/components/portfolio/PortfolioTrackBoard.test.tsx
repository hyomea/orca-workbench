// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from '../../../../shared/portfolio'
import { portfolioTracks } from './portfolio-tracks'
import { PortfolioTrackBoard } from './PortfolioTrackBoard'
import { PortfolioTrackView } from './PortfolioTrackView'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? ''))
}))
afterEach(cleanup)

function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
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
    {
      kind: 'role.create',
      role: {
        name: 'Android Engineer',
        agentName: 'Koko',
        agent: 'claude',
        responsibility: 'Build'
      }
    },
    'role'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'engineering',
        title: 'Test foundation',
        description: 'Tests',
        acceptanceCriteria: 'Tests run on PRs',
        designReferences: '',
        tickets: [
          { platform: 'android', reference: 'https://luduscom.atlassian.net/browse/ENG-5952' },
          { platform: 'ios', reference: '' },
          { platform: 'backend', reference: 'ENG-7872' }
        ],
        parity: false
      }
    },
    'outcome'
  )
  for (const stage of ['development', 'codeReview'] as const) {
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          roleId: 'role',
          platform: 'android',
          stage,
          title: `Android ${stage}`,
          instructions: 'Work',
          acceptanceCriteria: 'Done'
        }
      },
      stage
    )
  }
  apply(state, {
    kind: 'task.steps',
    taskId: 'development',
    steps: [
      { id: 'S1', title: 'Port tests' },
      { id: 'S2', title: 'CI' }
    ]
  })
  apply(state, { kind: 'task.step', taskId: 'development', stepId: 'S1', done: true })
  return state
}

it('shows each outcome platform as a row of stages and opens a stage’s task', () => {
  const state = fixture()
  const onSelectTask = vi.fn()
  render(
    <PortfolioTrackBoard
      state={state}
      tracks={portfolioTracks(state, undefined, {}, 10)}
      showProject={false}
      pinned={new Set()}
      foldNotStarted={false}
      onTogglePin={() => {}}
      onSelectTask={onSelectTask}
    />
  )
  // One group per outcome; a platform without a ticket number has no row yet.
  const group = screen.getByRole('rowgroup', { name: 'Test foundation' })
  const [android, backend, ...others] = within(group)
    .getAllByRole('row')
    .filter((row) => within(row).queryByRole('rowheader')?.textContent !== 'Test foundation')
  expect(others).toEqual([])
  expect(within(android).getByRole('rowheader').textContent).toBe('AndroidENG-5952')
  const development = within(android).getByRole('button', {
    name: 'Development: Android development'
  })
  expect(within(development).getByText('Koko · Android Engineer')).toBeTruthy()
  expect(within(development).getByText('Ready to start')).toBeTruthy()
  expect(within(development).getByText('Steps 1/2')).toBeTruthy()
  expect(
    within(
      within(android).getByRole('button', { name: 'Code review: Android codeReview' })
    ).getByText('Starts when development submits')
  ).toBeTruthy()
  expect(within(android).getByText('Not planned')).toBeTruthy()
  expect(within(backend).getByText('Tracked on ENG-7872')).toBeTruthy()
  expect(screen.queryByText('iOS')).toBeNull()
  fireEvent.click(development)
  expect(onSelectTask).toHaveBeenCalledWith('development')
})

it('keeps a team track with an open PR under code review instead of done', () => {
  const state = fixture()
  apply(state, { kind: 'project.reviewMode', projectId: 'project', mode: 'team' })
  preparePortfolioAttempt(state, 'development', 'w', 'r', 'op', 1).state = 'launched'
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'review',
    note: 'Built',
    commit: 'abc1234'
  })
  preparePortfolioAttempt(state, 'codeReview', 'w', 'r', 'op2', 2).state = 'launched'
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'review', note: 'Pass' })
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'OK' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'accepted',
    note: 'OK',
    codeReview: 'reviewed'
  })
  render(
    <PortfolioTrackBoard
      state={state}
      tracks={portfolioTracks(state, undefined, {}, 10, (worktreeId) => ({
        worktreeId,
        status: 'inReview',
        number: 276
      }))}
      showProject={false}
      pinned={new Set()}
      foldNotStarted
      onTogglePin={() => {}}
      onSelectTask={() => {}}
    />
  )
  const android = screen
    .getAllByRole('row')
    .find((row) => within(row).queryByRole('rowheader')?.textContent === 'AndroidENG-5952')!
  const review = within(android).getByRole('button', { name: 'Code review: Android codeReview' })
  expect(within(review).getByText('#276 · Waiting on review or CI')).toBeTruthy()
  expect(review.className).toContain('border-foreground/40')
  expect(within(android).queryByText('Done')).toBeNull()
})

it('lists tickets by stage, filters by who acts next, and pins a ticket to the top', () => {
  window.localStorage.clear()
  const state = fixture()
  const onSelectTask = vi.fn()
  render(
    <PortfolioTrackView
      state={state}
      tracks={portfolioTracks(state, undefined, {}, 10)}
      showProject={false}
      onSelectTask={onSelectTask}
    />
  )
  // Nobody started the Android work, so it folds away; another team's ticket stays in view.
  const notStarted = screen.getByRole('button', { name: /^Not started/ })
  expect(notStarted.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('ENG-5952')).toBeNull()
  expect(screen.getByText('ENG-7872')).toBeTruthy()
  // A filter shows its matching tickets wherever they stand.
  const needsYou = screen.getByRole('button', { name: 'Needs you: 1' })
  fireEvent.click(needsYou)
  expect(needsYou.getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByText('ENG-7872')).toBeNull()
  fireEvent.click(screen.getByText('ENG-5952'))
  expect(onSelectTask).toHaveBeenCalledWith('development')
  fireEvent.click(needsYou)
  fireEvent.click(screen.getByRole('button', { name: /^Not started/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Pin ENG-5952 to the top' }))
  expect(screen.getByRole('button', { name: /^Pinned/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Not started/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Unpin ENG-5952' })).toBeTruthy()
})
