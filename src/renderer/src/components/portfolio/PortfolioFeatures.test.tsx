// @vitest-environment happy-dom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  type PortfolioCommand
} from '../../../../shared/portfolio'
import { PortfolioFeatures } from './PortfolioFeatures'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { PortfolioProjectBoard } from './PortfolioProjectBoard'
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
function harness(view: 'outcomes' | 'features' = 'outcomes') {
  const commands: PortfolioCommand[] = []
  const onCreateTask = vi.fn()
  function App() {
    const [state, setState] = useState(initialState)
    return (
      <PortfolioFeatures
        view={view}
        state={state}
        projectId="project"
        draftScope="test"
        busy={false}
        error=""
        onCreateTask={onCreateTask}
        onCreateRole={() => {}}
        onOpenTasks={() => {}}
        onDiscuss={() => {}}
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

it('creates a feature and a parity outcome for it, then requires explicit reviewed publication', async () => {
  const { commands } = harness('features')
  await click('New feature')
  enter('Name', 'Reporting')
  enter('User outcome and shared context', 'Consistent counts')
  await click('Confirm and save')
  fireEvent.click(screen.getByRole('button', { name: /Reporting/ }))
  await click('New outcome')
  enter('Name', 'First delivery')
  enter('Acceptance criteria', 'Show sold and remaining counts')
  enter('Design references and notes', 'Design screenshot A')
  fireEvent.click(screen.getByRole('checkbox', { name: 'iOS' }))
  enter('iOS ticket', 'DEMO-1')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Android' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /must behave the same/ }))
  await click('Confirm and save')
  expect(commands.at(-1)).toMatchObject({
    kind: 'workItem.create',
    workItem: {
      featureId: expect.any(String),
      parity: true,
      tickets: [
        { platform: 'ios', reference: 'DEMO-1' },
        { platform: 'android', reference: '' }
      ]
    }
  })
  expect(screen.getByText('No published specification yet')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /First delivery/ }))
  expect(screen.getByText('Show sold and remaining counts')).toBeTruthy()
  await tab('Sign-off')
  enter('Sign-off note', 'Both app builds checked')
  // A parity outcome signs off only once both platforms have reviewed passing evidence.
  expect(screen.getByRole('button', { name: 'Sign off' })).toHaveProperty('disabled', true)
  await click('Open parity & tests')
  await click('Create test plan')
  enter('AC covered by this scenario', 'Show sold and remaining counts')
  enter('Preconditions and shared test data', 'Event with 20 seats and 5 sales')
  enter('Test steps', 'Open report and refresh')
  enter('Expected behavior on both platforms', '5 sold, 15 remaining')
  enter('Plan change note', 'Cover both counters')
  await tab('Shared context')
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
  await tab('Sign-off')
  enter('Sign-off note', 'Reviewed both platform results')
  await click('Sign off')
  expect(commands.some((command) => command.kind === 'feature.publish')).toBe(false)
  enter('Sign-off note', 'Use this complete specification')
  await click('Publish as current specification')
  expect(commands.some((command) => command.kind === 'feature.publish')).toBe(false)
  await click('Confirm publication')
  expect(commands.at(-1)?.kind).toBe('feature.publish')
  expect(
    screen.getByText(
      'This work published a specification. Create a new outcome for further changes.'
    )
  ).toBeTruthy()
  await click('Back to {{feature}}')
  expect(screen.getByText('Current specification v{{version}}')).toBeTruthy()
})

it('retains an unfinished work item when its editor closes and clears it only after save', async () => {
  const draftKey = createBrowserUuid()
  const onClose = vi.fn()
  const onSave = vi.fn(async () => true)
  const props = {
    mode: 'outcome' as const,
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
        projectId: 'project',
        featureId: 'feature',
        kind: 'bug',
        title: 'Wrong count',
        description: '',
        acceptanceCriteria: '',
        designReferences: '',
        tickets: [],
        parity: true
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
      stage: 'development',
      platform: 'shared',
      title: 'Fix iOS count',
      instructions: 'Correct the calculation',
      acceptanceCriteria: 'Regression case passes'
    }
  })
})

it('starts an improvement with the current specification and preserves that baseline when a newer version arrives', async () => {
  const specification = {
    version: 1,
    workItemId: 'previous',
    description: 'Report inventory',
    acceptanceCriteria: 'Show sold and remaining',
    designReferences: 'Count design',
    sourceReference: 'AC-1',
    at: 1,
    note: 'Baseline'
  }
  const onSave = vi.fn(async () => true)
  const props = {
    mode: 'outcome' as const,
    projectId: 'project',
    featureId: 'feature',
    draftKey: createBrowserUuid(),
    hasSpecification: true,
    specification,
    busy: false,
    saveError: '',
    onSave,
    onClose: () => {}
  }
  const editor = render(<PortfolioFeatureComposer {...props} />)
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty(
    'value',
    specification.acceptanceCriteria
  )
  expect(screen.getByLabelText('Design references and notes')).toHaveProperty(
    'value',
    specification.designReferences
  )
  enter('Name', 'Add ticket types')
  enter('Acceptance criteria', `${specification.acceptanceCriteria}; include ticket types`)
  editor.rerender(
    <PortfolioFeatureComposer
      {...props}
      specification={{ ...specification, version: 2, acceptanceCriteria: 'A newer baseline' }}
    />
  )
  await click('Confirm and save')
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'workItem.create',
      expectedBaseVersion: 1,
      workItem: expect.objectContaining({
        acceptanceCriteria: 'Show sold and remaining; include ticket types'
      })
    })
  )
})

it('applies an editable role template without assigning or launching a task', async () => {
  const onSave = vi.fn(async () => true)
  render(
    <PortfolioComposer
      kind="role"
      state={initialState()}
      projectId="project"
      busy={false}
      saveError=""
      onSave={onSave}
      onClose={() => {}}
    />
  )
  await click('Apply template')
  expect(screen.getByLabelText('Role name')).toHaveProperty('value', 'Product Analyst')
  expect(screen.getByLabelText('Responsibility')).toHaveProperty(
    'value',
    expect.stringContaining('testable acceptance criteria')
  )
  enter('Role name', 'Mobile Product Analyst')
  await click('Save')
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'role.create',
      role: expect.objectContaining({ name: 'Mobile Product Analyst', agent: 'codex' })
    })
  )
})

it('keeps the selected feature when switching project views and discloses full project context on demand', async () => {
  const state = initialState()
  state.features.push({
    id: 'feature',
    projectId: 'project',
    name: 'Report counts',
    description: 'Consistent mobile reporting',
    versions: []
  })
  const noop = () => {}
  render(
    <PortfolioProjectBoard
      project={state.projects[0]}
      tasks={[]}
      roles={[]}
      repos={[]}
      onCreateTask={noop}
      onEditProject={noop}
      onCreateRole={noop}
      onOpenTasks={noop}
      featureContent={
        <PortfolioFeatures
          view="features"
          state={state}
          projectId="project"
          draftScope="switch-test"
          busy={false}
          error=""
          onSave={async () => true}
          onCreateTask={noop}
          onSelectTask={noop}
          onCreateRole={noop}
          onOpenTasks={noop}
          onDiscuss={() => {}}
        />
      }
    />
  )
  await click('Features')
  fireEvent.click(screen.getByRole('button', { name: /Report counts/ }))
  expect(screen.getByRole('heading', { name: 'Report counts' })).toBeTruthy()
  await click('Tasks')
  expect(screen.queryByRole('heading', { name: 'Report counts' })).toBeNull()
  await click('Features')
  expect(screen.getByRole('heading', { name: 'Report counts' })).toBeTruthy()
  const context = screen.getByText('Initiative context · {{count}} sources').closest('details')
  expect(context?.open).toBe(false)
  fireEvent.click(screen.getByText('Initiative context · {{count}} sources'))
  expect(context?.open).toBe(true)
})

it('creates an outcome with no feature for platform-specific engineering work', async () => {
  const { commands } = harness()
  await click('New outcome')
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Work type' }))
  await user.click(screen.getByRole('option', { name: 'Engineering' }))
  enter('Name', 'Test foundation')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Android' }))
  enter('Android ticket', 'ENG-5952')
  await click('Confirm and save')
  expect(commands.at(-1)).toEqual({
    kind: 'workItem.create',
    expectedBaseVersion: 0,
    workItem: expect.objectContaining({
      projectId: 'project',
      kind: 'engineering',
      title: 'Test foundation',
      parity: false,
      tickets: [{ platform: 'android', reference: 'ENG-5952' }]
    })
  })
  expect(commands.at(-1)).not.toHaveProperty('workItem.featureId')
  fireEvent.click(screen.getByRole('button', { name: /Test foundation/ }))
  await tab('Parity & tests')
  expect(screen.getByText(/no shared test plan is required/)).toBeTruthy()
})

it('opens each outcome as its own page and returns to the list', async () => {
  const state = initialState()
  for (const title of ['Test foundation', 'Multi check-in']) {
    applyPortfolioCommand(
      state,
      {
        kind: 'workItem.create',
        workItem: {
          projectId: 'project',
          kind: 'engineering',
          title,
          description: '',
          acceptanceCriteria: `${title} works`,
          designReferences: '',
          tickets: [],
          parity: false
        }
      },
      title,
      1
    )
  }
  render(
    <PortfolioFeatures
      state={state}
      projectId="project"
      draftScope="test"
      busy={false}
      error=""
      onCreateTask={() => {}}
      onCreateRole={() => {}}
      onOpenTasks={() => {}}
      onDiscuss={() => {}}
      onSelectTask={() => {}}
      onSave={async () => true}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Test foundation/ }))
  expect(screen.getByRole('heading', { name: 'Test foundation' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Multi check-in/ })).toBeNull()
  await click('All outcomes')
  fireEvent.click(screen.getByRole('button', { name: /Multi check-in/ }))
  expect(screen.getByRole('heading', { name: 'Multi check-in' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Test foundation' })).toBeNull()
})

it('records a feature’s parity row with evidence for each platform', async () => {
  const { commands } = harness('features')
  await click('New feature')
  enter('Name', 'Check-in')
  await click('Confirm and save')
  fireEvent.click(screen.getByRole('button', { name: /Check-in/ }))
  expect(screen.getByText(/Not checked yet/)).toBeTruthy()
  await click('Record a parity check')
  const user = userEvent.setup()
  await user.click(screen.getAllByRole('combobox', { name: 'Status' })[0])
  await user.click(screen.getByRole('option', { name: 'Same' }))
  fireEvent.change(screen.getAllByLabelText('Evidence')[0], {
    target: { value: 'Staging build 15, simulator' }
  })
  await click('Save')
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.change(screen.getAllByLabelText('What differs, or why')[1], {
    target: { value: 'Needs a Bluetooth scanner' }
  })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Needs real hardware' }))
  await click('Save')
  expect(commands.at(-1)).toMatchObject({
    kind: 'feature.parity',
    parity: {
      ios: { status: 'same', evidence: 'Staging build 15, simulator' },
      android: { status: 'unknown', note: 'Needs a Bluetooth scanner' },
      needsHardware: true
    }
  })
  expect(screen.getByText('Needs a Bluetooth scanner')).toBeTruthy()
})
