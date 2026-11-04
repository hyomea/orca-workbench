// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from '../../../../shared/portfolio'
import { portfolioTracks } from './portfolio-tracks'
import { PortfolioTrackBoard } from './PortfolioTrackBoard'

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
          { platform: 'android', reference: 'ENG-5952' },
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
      onSelectTask={onSelectTask}
    />
  )
  expect(screen.getByText('Needs you: 1')).toBeTruthy()
  const [android, backend] = screen
    .getAllByRole('row')
    .filter((row) => within(row).queryByRole('rowheader'))
  expect(within(android).getByText('Android · ENG-5952')).toBeTruthy()
  const development = within(android).getByRole('button', {
    name: 'Development: Android development'
  })
  expect(within(development).getByText('Koko · Android Engineer')).toBeTruthy()
  expect(within(development).getByText('Ready to start')).toBeTruthy()
  expect(within(development).getByText('Steps 1/2')).toBeTruthy()
  expect(
    within(
      within(android).getByRole('button', { name: 'Code review: Android codeReview' })
    ).getByText('Waiting')
  ).toBeTruthy()
  expect(within(android).getByText('Not planned')).toBeTruthy()
  expect(within(backend).getByText('Tracked on ENG-7872')).toBeTruthy()
  fireEvent.click(development)
  expect(onSelectTask).toHaveBeenCalledWith('development')
})
