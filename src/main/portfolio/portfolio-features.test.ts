import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PortfolioStore } from './portfolio-store'
import {
  parsePortfolioState,
  applyPortfolioCommand,
  emptyPortfolio,
  preparePortfolioAttempt,
  PortfolioCommand,
  type PortfolioState
} from '../../shared/portfolio'
import { verificationTaskSnapshot } from '../../shared/portfolio-verification'
import { PortfolioWorkItemInput } from '../../shared/portfolio-features'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})
function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}
function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    {
      kind: 'project.create',
      project: { name: 'Mobile', objective: 'Parity', repoIds: ['ios', 'android'] }
    },
    'project'
  )
  apply(
    state,
    {
      kind: 'feature.create',
      feature: { projectId: 'project', name: 'Reports', description: 'Shared reporting behavior' }
    },
    'feature'
  )
  apply(
    state,
    {
      kind: 'role.create',
      role: { name: 'iOS', agent: 'codex', responsibility: 'Implement and test' }
    },
    'role'
  )
  return state
}
function createItem(state: PortfolioState, id: string, kind = 'initial'): void {
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        featureId: 'feature',
        kind,
        title: id,
        description: 'Reporting change',
        acceptanceCriteria: `Criteria for ${id}`,
        designReferences: 'Design section A',
        tickets: [{ platform: 'ios', reference: 'DEMO-1' }],
        parity: true
      }
    },
    id
  )
}
function verify(state: PortfolioState, workItemId: string): void {
  apply(state, {
    kind: 'verification.plan',
    workItemId,
    expectedVersion: 0,
    scenarios: [
      {
        id: 'scenario',
        criterion: 'AC',
        steps: 'Run scenario',
        testData: 'Same event',
        expected: 'Expected counts',
        platformNotes: ''
      }
    ],
    note: 'Shared plan'
  })
  apply(state, {
    kind: 'verification.confirm',
    workItemId,
    planVersion: 1,
    note: 'Coverage reviewed'
  })
  for (const platform of ['ios', 'android']) {
    const resultId = `${workItemId}:${platform}`
    apply(
      state,
      {
        kind: 'verification.record',
        workItemId,
        planVersion: 1,
        expectedTaskSnapshot: verificationTaskSnapshot(state, workItemId),
        result: {
          scenarioId: 'scenario',
          platform,
          outcome: 'pass',
          build: 'Build 1',
          environment: 'Test device',
          evidence: 'Observed expected counts'
        }
      },
      resultId
    )
    apply(state, {
      kind: 'verification.review',
      workItemId,
      resultId,
      decision: 'approved',
      note: 'Reviewed evidence'
    })
  }
}
function accept(state: PortfolioState, id: string): void {
  verify(state, id)
  apply(state, {
    kind: 'workItem.transition',
    workItemId: id,
    status: 'accepted',
    note: 'Reviewed the evidence'
  })
}
function task(state: PortfolioState, itemId: string, id = 'task', projectId = 'project'): void {
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId,
        workItemId: itemId,
        roleId: 'role',
        title: 'Implement',
        instructions: 'Follow the specification',
        acceptanceCriteria: 'Tests pass'
      }
    },
    id
  )
}

it('migrates v1 on write with an exact backup and preserves existing tasks and executions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-feature-migration-'))
  directories.push(directory)
  const file = join(directory, 'portfolio.json')
  const state = fixture()
  createItem(state, 'initial')
  task(state, 'initial')
  delete state.tasks[0].workItemId
  preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  const { features: _features, workItems: _items, ...legacyFields } = state
  const original = JSON.stringify({ ...legacyFields, schemaVersion: 1 })
  await writeFile(file, original)
  const store = new PortfolioStore(file)
  const migrated = await store.read()
  expect(migrated.schemaVersion).toBe(6)
  expect(migrated.features).toEqual([])
  expect(migrated.tasks).toEqual(state.tasks)
  expect(await readFile(file, 'utf8')).toBe(original)
  await store.update(0, (next) =>
    apply(
      next,
      {
        kind: 'feature.create',
        feature: { projectId: 'project', name: 'New feature', description: '' }
      },
      'new'
    )
  )
  expect(await readFile(`${file}.v1.bak`, 'utf8')).toBe(original)
  const reopened = await new PortfolioStore(file).read()
  expect(reopened.features[0].name).toBe('New feature')
  expect(reopened.tasks).toEqual(state.tasks)
})

it('keeps bug and improvement work separate and publishes only an accepted explicit proposal', () => {
  const state = fixture()
  createItem(state, 'initial')
  accept(state, 'initial')
  expect(state.features[0].versions).toHaveLength(0)
  apply(state, { kind: 'feature.publish', workItemId: 'initial', note: 'Current requirements' })
  const first = structuredClone(state.features[0].versions[0])
  createItem(state, 'bug', 'bug')
  createItem(state, 'improvement', 'improvement')
  expect(state.workItems[1].baseVersion).toBe(1)
  expect(state.features[0].versions).toEqual([first])
  accept(state, 'bug')
  expect(() =>
    apply(state, { kind: 'feature.publish', workItemId: 'bug', note: 'Do not publish bugs' })
  ).toThrow('Only accepted')
  expect(() =>
    apply(state, { kind: 'feature.publish', workItemId: 'improvement', note: 'Not reviewed' })
  ).toThrow('Only accepted')
  accept(state, 'improvement')
  apply(state, {
    kind: 'feature.publish',
    workItemId: 'improvement',
    note: 'Reviewed complete proposal'
  })
  expect(state.features[0].versions.map((entry) => entry.version)).toEqual([1, 2])
  expect(state.features[0].versions[0]).toEqual(first)
  expect(() =>
    apply(state, { kind: 'feature.publish', workItemId: 'improvement', note: 'Again' })
  ).toThrow('already')
  expect(() =>
    apply(state, {
      kind: 'workItem.transition',
      workItemId: 'initial',
      status: 'planned',
      note: 'Reopen'
    })
  ).toThrow('immutable')
})

it('rejects stale proposals rather than overwriting a newer specification', () => {
  const state = fixture()
  createItem(state, 'a')
  createItem(state, 'b')
  accept(state, 'a')
  accept(state, 'b')
  apply(state, { kind: 'feature.publish', workItemId: 'a', note: 'First' })
  expect(() => apply(state, { kind: 'feature.publish', workItemId: 'b', note: 'Stale' })).toThrow(
    'changed since'
  )
  expect(state.features[0].versions).toHaveLength(1)
})

it('validates project membership and requires reviewed linked tasks and closed executions', () => {
  const state = fixture()
  createItem(state, 'initial')
  apply(
    state,
    { kind: 'project.create', project: { name: 'Other', objective: 'Other', repoIds: [] } },
    'other'
  )
  expect(() => task(state, 'initial', 'bad', 'other')).toThrow('this initiative')
  expect(() => task(state, 'missing')).toThrow('this initiative')
  task(state, 'initial')
  expect(() =>
    apply(state, {
      kind: 'workItem.transition',
      workItemId: 'initial',
      status: 'accepted',
      note: 'Accept'
    })
  ).toThrow('Accept all linked')
  preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  state.tasks[0].attempts[0].state = 'launched'
  apply(state, {
    kind: 'task.transition',
    taskId: 'task',
    status: 'review',
    note: 'Tests pass',
    commit: 'f3867912'
  })
  expect(state.tasks[0].history.at(-1)).toMatchObject({ status: 'review', commit: 'f3867912' })
  expect(() =>
    apply(state, { kind: 'task.transition', taskId: 'task', status: 'accepted', note: 'Reviewed' })
  ).toThrow('reviewed the code or skipped it')
  apply(state, {
    kind: 'task.transition',
    taskId: 'task',
    status: 'accepted',
    note: 'Reviewed',
    codeReview: 'reviewed'
  })
  expect(state.tasks[0].history.at(-1)).toMatchObject({
    status: 'accepted',
    codeReview: 'reviewed'
  })
  expect(() =>
    apply(state, {
      kind: 'workItem.transition',
      workItemId: 'initial',
      status: 'accepted',
      note: 'Accept'
    })
  ).toThrow('Stop and close')
  apply(state, { kind: 'task.closeExecution', taskId: 'task', note: 'Agent stopped' })
  verify(state, 'initial')
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'initial',
    status: 'accepted',
    note: 'Accept'
  })
  expect(() =>
    apply(state, { kind: 'task.transition', taskId: 'task', status: 'todo', note: 'More' })
  ).toThrow('Reopen the outcome')
})

it('snapshots feature and work item context and replays the same prompt after a new publication', () => {
  const state = fixture()
  createItem(state, 'initial')
  accept(state, 'initial')
  apply(state, { kind: 'feature.publish', workItemId: 'initial', note: 'v1' })
  createItem(state, 'bug', 'bug')
  task(state, 'bug')
  const original = preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1).prompt
  expect(original).toContain('Feature: Reports')
  expect(original).toContain('Criteria for initial')
  expect(original).toContain('Criteria for bug')
  state.tasks[0].attempts[0].state = 'unknown'
  createItem(state, 'next', 'improvement')
  accept(state, 'next')
  apply(state, { kind: 'feature.publish', workItemId: 'next', note: 'v2' })
  expect(
    preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'other-operation', 2).prompt
  ).toBe(original)
})

it('allows triage corrections before tasks while rejecting stale edits and cross-project relinks', () => {
  const state = fixture()
  createItem(state, 'issue', 'investigation')
  const expected = PortfolioWorkItemInput.parse(state.workItems[0])
  const workItem = { ...expected, kind: 'bug', title: 'Confirmed bug' }
  apply(state, { kind: 'workItem.update', workItemId: 'issue', workItem, expected })
  expect(() =>
    apply(state, { kind: 'workItem.update', workItemId: 'issue', workItem, expected })
  ).toThrow('changed')
  task(state, 'issue')
  expect(() =>
    apply(state, { kind: 'workItem.update', workItemId: 'issue', workItem, expected: workItem })
  ).toThrow('all tasks accepted')
  apply(state, { kind: 'task.linkWorkItem', taskId: 'task' })
  expect(state.tasks[0].workItemId).toBeUndefined()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Other', objective: 'Other', repoIds: [] } },
    'other'
  )
  apply(
    state,
    {
      kind: 'feature.create',
      feature: { projectId: 'other', name: 'Other feature', description: '' }
    },
    'other-feature'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: { ...expected, projectId: 'other', featureId: 'other-feature' }
    },
    'other-item'
  )
  expect(() =>
    apply(state, { kind: 'task.linkWorkItem', taskId: 'task', workItemId: 'other-item' })
  ).toThrow('this initiative')
  apply(state, { kind: 'task.linkWorkItem', taskId: 'task', workItemId: 'issue' })
  preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  expect(() => apply(state, { kind: 'task.linkWorkItem', taskId: 'task' })).toThrow(
    'no open execution'
  )
})

it('tells a named agent its name when the task starts', () => {
  const state = fixture()
  state.roles[0].agentName = 'Nova'
  createItem(state, 'initial')
  task(state, 'initial')
  const { prompt } = preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  expect(prompt).toContain('Role: iOS\n\nYour name: Nova\n\n')
})

it('plans backend API work as its own platform', () => {
  const state = fixture()
  createItem(state, 'initial')
  task(state, 'initial')
  state.tasks[0].platform = 'backend'
  const { prompt } = preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  expect(prompt).toContain('Target platform: backend')
})

it('migrates schema 5 work items into outcomes that keep their source and evidence rule', () => {
  const state = fixture()
  createItem(state, 'planned-item')
  createItem(state, 'tested-item')
  const {
    projectId: _projectId,
    tickets: _tickets,
    parity: _parity,
    ...legacy
  } = state.workItems[0]
  const migrated = parsePortfolioState({
    ...state,
    schemaVersion: 5,
    workItems: state.workItems.map((item) => ({
      ...legacy,
      id: item.id,
      sourceReference: 'https://example.atlassian.net/browse/ENG-1'
    }))
  })
  expect(migrated.schemaVersion).toBe(6)
  expect(migrated.workItems.map((item) => [item.projectId, item.parity, item.tickets])).toEqual([
    ['project', true, [{ reference: 'https://example.atlassian.net/browse/ENG-1' }]],
    ['project', true, [{ reference: 'https://example.atlassian.net/browse/ENG-1' }]]
  ])
  apply(migrated, {
    kind: 'workItem.scope',
    workItemId: 'planned-item',
    tickets: [{ platform: 'android', reference: 'ENG-5952' }],
    parity: false
  })
  expect(migrated.workItems[0]).toMatchObject({
    parity: false,
    tickets: [{ platform: 'android', reference: 'ENG-5952' }]
  })
  expect(migrated.workItems[0].featureId).toBe('feature')
  apply(migrated, {
    kind: 'workItem.scope',
    workItemId: 'planned-item',
    tickets: [{ platform: 'android', reference: 'ENG-5952' }],
    parity: false,
    feature: null
  })
  expect(migrated.workItems[0]).not.toHaveProperty('featureId')
  expect(() => apply(migrated, { kind: 'feature.delete', featureId: 'feature' })).toThrow(
    'no outcomes'
  )
})

it('accepts an outcome without a feature or a shared test plan when parity is not required', () => {
  const state = fixture()
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'engineering',
        title: 'Test foundation',
        description: '',
        acceptanceCriteria: 'Unit tests run in CI on both platforms',
        designReferences: '',
        tickets: [
          { platform: 'android', reference: 'ENG-5952' },
          { platform: 'ios', reference: '' }
        ],
        parity: false
      }
    },
    'foundation'
  )
  task(state, 'foundation')
  const { prompt } = preparePortfolioAttempt(state, 'task', 'workspace', 'ios', 'operation', 1)
  expect(prompt).toContain('Same behavior on iOS and Android required: no')
  expect(prompt).toContain('android: ENG-5952')
  state.tasks[0].attempts[0].state = 'launched'
  apply(state, { kind: 'task.transition', taskId: 'task', status: 'review', note: 'Done' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'task',
    status: 'accepted',
    note: 'Reviewed',
    codeReview: 'reviewed'
  })
  apply(state, { kind: 'task.closeExecution', taskId: 'task', note: 'Finished' })
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'foundation',
    status: 'accepted',
    note: 'Accepted'
  })
  expect(state.workItems.find((item) => item.id === 'foundation')?.status).toBe('accepted')
})
