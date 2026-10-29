// @vitest-environment happy-dom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createBrowserUuid } from '@/lib/browser-uuid'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  type PortfolioCommand
} from '../../../../shared/portfolio'
import { PortfolioFeatures } from './PortfolioFeatures'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { PortfolioComposer } from './PortfolioComposer'

vi.mock('@/i18n/i18n', () => ({
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string) => fallback
}))
afterEach(cleanup)
function initialState() {
  const state = emptyPortfolio()
  state.projects.push({ id: 'project', name: 'Mobile', objective: 'Parity', repoIds: [] })
  return state
}
function harness() {
  const commands: PortfolioCommand[] = []
  const onCreateTask = vi.fn()
  function App() {
    const [state, setState] = useState(initialState)
    return (
      <PortfolioFeatures
        state={state}
        projectId="project"
        draftScope="test"
        busy={false}
        error=""
        onCreateTask={onCreateTask}
        onCreateRole={() => {}}
        onSelectTask={() => {}}
        onSave={async (command) => {
          commands.push(command)
          const next = structuredClone(state)
          applyPortfolioCommand(next, command, createBrowserUuid(), Date.now())
          setState(next)
          return true
        }}
      />
    )
  }
  render(<App />)
  return { commands, onCreateTask }
}
async function click(text: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: text }))
  })
}
async function tab(name: string): Promise<void> {
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
  })
}
function enter(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

it('creates a feature and a separate initial delivery, then requires explicit reviewed publication', async () => {
  const { commands } = harness()
  await click('New feature')
  enter('Name', 'Reporting')
  enter('User outcome and shared context', 'Consistent counts')
  await click('Confirm and save')
  fireEvent.click(screen.getByRole('button', { name: /Reporting/ }))
  await click('New work item')
  enter('Name', 'First delivery')
  enter('Acceptance criteria', 'Show sold and remaining counts')
  enter('Design references and notes', 'Design screenshot A')
  enter('Jira or source reference', 'DEMO-1')
  await click('Confirm and save')
  fireEvent.click(screen.getByRole('button', { name: /First delivery/ }))
  expect(screen.getByText('Show sold and remaining counts')).toBeTruthy()
  expect(screen.getByText('No published specification yet')).toBeTruthy()
  await tab('Review')
  enter('Evidence or review note', 'Both app builds checked')
  await click('In review')
  enter('Evidence or review note', 'Reviewed evidence')
  expect(screen.getByRole('button', { name: 'Accepted' })).toHaveProperty('disabled', true)
  await tab('Parity & tests')
  await click('Create test plan')
  enter('AC covered by this scenario', 'Show sold and remaining counts')
  enter('Preconditions and shared test data', 'Event with 20 seats and 5 sales')
  enter('Test steps', 'Open report and refresh')
  enter('Expected behavior on both platforms', '5 sold, 15 remaining')
  enter('Plan change note', 'Cover both counters')
  await tab('Tasks')
  await tab('Parity & tests')
  await click('Create test plan')
  expect(screen.getByLabelText('Test steps')).toHaveProperty('value', 'Open report and refresh')
  await click('Save test plan')
  enter('Coverage review note', 'Checked AC and design')
  await click('Confirm AC and scenario coverage')
  for (const platform of ['iOS', 'Android']) {
    await click(`${platform} Not run`)
    await click('Record test result')
    enter('Build or commit', 'Build 15')
    enter('Device, OS, and environment', `${platform} simulator, staging`)
    enter('Actual result and evidence', 'Observed 5 sold, 15 remaining; screenshot reference')
    await click('Close and keep draft')
    await click('Record test result')
    expect(screen.getByLabelText('Actual result and evidence')).toHaveProperty(
      'value',
      'Observed 5 sold, 15 remaining; screenshot reference'
    )
    await click('Save test result')
    enter('Evidence review note', 'Matches shared scenario')
    await click('Approve evidence')
  }
  await tab('Review')
  enter('Evidence or review note', 'Reviewed both platform results')
  await click('Accepted')
  expect(commands.some((command) => command.kind === 'feature.publish')).toBe(false)
  expect(screen.getByText('No published specification yet')).toBeTruthy()
  enter('Evidence or review note', 'Use this complete specification')
  await click('Publish as current specification')
  expect(commands.some((command) => command.kind === 'feature.publish')).toBe(false)
  await click('Confirm publication')
  expect(commands.at(-1)?.kind).toBe('feature.publish')
  expect(
    screen.getByText(
      'This work published a specification. Create a new work item for further changes.'
    )
  ).toBeTruthy()
})

it('retains an unfinished work item when its editor closes and clears it only after save', async () => {
  const draftKey = createBrowserUuid()
  const onClose = vi.fn()
  const onSave = vi.fn(async () => true)
  const props = {
    projectId: 'project',
    featureId: 'feature',
    draftKey,
    busy: false,
    saveError: '',
    onClose,
    onSave
  }
  const first = render(<PortfolioFeatureComposer {...props} />)
  enter('Name', 'New issue')
  enter('Acceptance criteria', 'Expected behavior')
  await click('Close and keep draft')
  expect(onClose).toHaveBeenCalledOnce()
  first.unmount()
  const second = render(<PortfolioFeatureComposer {...props} />)
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'New issue')
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty('value', 'Expected behavior')
  await click('Confirm and save')
  second.unmount()
  render(<PortfolioFeatureComposer {...props} />)
  expect(screen.getByLabelText('Name')).toHaveProperty('value', '')
})

it('creates an agent task linked to the selected work item', async () => {
  const state = initialState()
  state.roles.push({
    id: 'role',
    name: 'iOS Engineer',
    responsibility: 'Implement',
    agent: 'codex'
  })
  applyPortfolioCommand(
    state,
    { kind: 'feature.create', feature: { projectId: 'project', name: 'Reports', description: '' } },
    'feature',
    1
  )
  applyPortfolioCommand(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        featureId: 'feature',
        kind: 'bug',
        title: 'Wrong count',
        description: '',
        acceptanceCriteria: '',
        designReferences: '',
        sourceReference: ''
      }
    },
    'bug',
    2
  )
  const onSave = vi.fn(async () => true)
  render(
    <PortfolioComposer
      kind="task"
      state={state}
      projectId="project"
      workItemId="bug"
      busy={false}
      saveError=""
      onSave={onSave}
      onClose={() => {}}
    />
  )
  enter('Name', 'Fix iOS count')
  enter('Instructions', 'Correct the calculation')
  enter('Acceptance criteria', 'Regression case passes')
  await click('Save')
  expect(onSave).toHaveBeenCalledWith({
    kind: 'task.create',
    task: {
      projectId: 'project',
      workItemId: 'bug',
      roleId: 'role',
      platform: 'shared',
      title: 'Fix iOS count',
      instructions: 'Correct the calculation',
      acceptanceCriteria: 'Regression case passes'
    }
  })
})
