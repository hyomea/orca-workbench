import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from '../../shared/portfolio'
import { verificationProgress, verificationTaskSnapshot } from '../../shared/portfolio-verification'
import { PortfolioWorkItemInput } from '../../shared/portfolio-features'
import { PortfolioStore } from './portfolio-store'

import { portfolioTicketsText } from '../../shared/portfolio-features'
// Work items as schema 5 and earlier stored them: under a feature, with one source reference.
function legacyWorkItems(items: PortfolioState['workItems']) {
  return items.map(({ projectId: _projectId, tickets, parity: _parity, ...item }) => ({
    ...item,
    sourceReference: portfolioTicketsText(tickets)
  }))
}

function apply(state: PortfolioState, command: unknown, id: string = randomUUID()) {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, Date.now())
}
const scenario = {
  id: 'counts',
  criterion: 'Show sold and remaining',
  steps: 'Open event, sell a ticket, refresh',
  testData: 'Event A, capacity 20, initially 5 sold',
  expected: '6 sold and 14 remaining on both platforms',
  platformNotes: 'Use native navigation on each platform'
}
function fixture() {
  const state = emptyPortfolio()
  state.projects.push({
    id: 'project',
    name: 'Mobile',
    objective: 'Parity',
    repoIds: ['ios', 'android']
  })
  state.roles.push({
    id: 'engineer',
    name: 'Engineer',
    agent: 'codex',
    responsibility: 'Implement and test'
  })
  apply(
    state,
    {
      kind: 'feature.create',
      feature: { projectId: 'project', name: 'Reports', description: 'Report counts' }
    },
    'feature'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        featureId: 'feature',
        kind: 'initial',
        title: 'Report counts',
        description: 'Show current counts',
        acceptanceCriteria: 'Show sold and remaining',
        designReferences: 'design.png notes',
        tickets: [{ reference: 'AC-1' }],
        parity: true
      }
    },
    'item'
  )
  return state
}
function plan(state: PortfolioState) {
  const version = verificationProgress(state, 'item').plan?.version ?? 0
  apply(state, {
    kind: 'verification.plan',
    workItemId: 'item',
    expectedVersion: version,
    scenarios: [scenario],
    note: 'Review counts and refresh'
  })
}
function confirm(state: PortfolioState) {
  apply(state, {
    kind: 'verification.confirm',
    workItemId: 'item',
    planVersion: verificationProgress(state, 'item').plan?.version,
    note: 'AC and design covered by shared scenario'
  })
}
function record(
  state: PortfolioState,
  platform: 'ios' | 'android',
  outcome = 'pass',
  id: string = randomUUID()
) {
  apply(
    state,
    {
      kind: 'verification.record',
      workItemId: 'item',
      planVersion: verificationProgress(state, 'item').plan?.version,
      expectedTaskSnapshot: verificationTaskSnapshot(state, 'item'),
      result: {
        scenarioId: 'counts',
        platform,
        outcome,
        build: 'commit-a',
        environment: 'Simulator / staging',
        evidence: 'Observed counts, screenshot and test log'
      }
    },
    id
  )
  return id
}
function review(state: PortfolioState, resultId: string, decision = 'approved') {
  apply(state, {
    kind: 'verification.review',
    workItemId: 'item',
    resultId,
    decision,
    note: 'Compared evidence with the expected behavior'
  })
}
function acceptTask(state: PortfolioState, id: string) {
  apply(state, {
    kind: 'task.transition',
    taskId: id,
    status: 'review',
    note: 'Implementation and regression evidence'
  })
  apply(state, {
    kind: 'task.transition',
    taskId: id,
    status: 'accepted',
    note: 'Reviewed changes',
    codeReview: 'reviewed'
  })
}
function accept(state: PortfolioState) {
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'item',
    status: 'accepted',
    note: 'Reviewed change and both platform results'
  })
}

it('persists a failed-test → agent fix → retest → evidence review → acceptance → publication loop', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-verification-'))
  try {
    const state = fixture()
    plan(state)
    expect(() => record(state, 'ios')).toThrow('Confirm scenario coverage')
    confirm(state)
    review(state, record(state, 'ios'))
    const failure = record(state, 'android', 'fail')
    review(state, failure)
    expect(verificationProgress(state, 'item').ready).toBe(false)
    apply(
      state,
      { kind: 'verification.fix', workItemId: 'item', resultId: failure, roleId: 'engineer' },
      'fix'
    )
    expect(state.tasks[0]).toMatchObject({
      workItemId: 'item',
      platform: 'android',
      status: 'todo'
    })
    expect(verificationProgress(state, 'item').passed).toBe(0)
    expect(() =>
      apply(state, {
        kind: 'verification.fix',
        workItemId: 'item',
        resultId: failure,
        roleId: 'engineer'
      })
    ).toThrow()
    const attempt = preparePortfolioAttempt(state, 'fix', 'workspace', 'android', 'operation', 1)
    expect(attempt.prompt).toContain('Target platform: android')
    expect(attempt.prompt).toContain('Observed counts, screenshot and test log')
    expect(attempt.prompt).toContain('Compared evidence with the expected behavior')
    expect(attempt.prompt).toContain('6 sold and 14 remaining')
    attempt.state = 'launched'
    expect(() => record(state, 'android')).toThrow('Stop and close')
    acceptTask(state, 'fix')
    apply(state, { kind: 'task.closeExecution', taskId: 'fix', note: 'Stopped the agent' })
    expect(() => accept(state)).toThrow('review passing evidence')
    review(state, record(state, 'ios'))
    const android = record(state, 'android')
    expect(() => accept(state)).toThrow('review passing evidence')
    review(state, android)
    expect(verificationProgress(state, 'item').ready).toBe(true)
    accept(state)
    expect(state.features[0].versions).toHaveLength(0)
    apply(state, {
      kind: 'feature.publish',
      workItemId: 'item',
      note: 'Publish reviewed specification'
    })
    expect(() => record(state, 'ios')).toThrow('open outcome')
    const store = new PortfolioStore(join(directory, 'portfolio.json'))
    await store.update(0, (next) => Object.assign(next, state))
    const reopened = await new PortfolioStore(store.file).read()
    expect(reopened.verification).toEqual(state.verification)
    expect(reopened.features[0].versions[0].workItemId).toBe('item')
    expect(reopened.tasks[0].attempts[0].prompt).toBe(attempt.prompt)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('invalidates evidence after task changes or plan revision and keeps every previous result', () => {
  const state = fixture()
  plan(state)
  confirm(state)
  const first = record(state, 'ios')
  review(state, first)
  review(state, record(state, 'android'))
  expect(verificationProgress(state, 'item').ready).toBe(true)
  const rejected = record(state, 'ios')
  review(state, rejected, 'rejected')
  expect(verificationProgress(state, 'item').ready).toBe(false)
  expect(() => review(state, first)).toThrow('outdated')
  expect(() => review(state, rejected)).toThrow('already reviewed')
  review(state, record(state, 'ios'))
  const oldSnapshot = verificationTaskSnapshot(state, 'item')
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'item',
        roleId: 'engineer',
        title: 'Adjust layout',
        instructions: 'Match design',
        acceptanceCriteria: 'Layout matches'
      }
    },
    'task'
  )
  expect(verificationProgress(state, 'item').ready).toBe(false)
  expect(() =>
    apply(state, {
      kind: 'verification.record',
      workItemId: 'item',
      planVersion: 1,
      expectedTaskSnapshot: oldSnapshot,
      result: {
        scenarioId: 'counts',
        platform: 'ios',
        outcome: 'pass',
        build: 'b',
        environment: 'device',
        evidence: 'old observation'
      }
    })
  ).toThrow('Work changed')
  acceptTask(state, 'task')
  review(state, record(state, 'ios'))
  review(state, record(state, 'android'))
  apply(state, { kind: 'task.transition', taskId: 'task', status: 'todo', note: 'Rework' })
  expect(verificationProgress(state, 'item').ready).toBe(false)
  const resultCount = state.verification[0].results.length
  plan(state)
  expect(verificationProgress(state, 'item')).toMatchObject({ ready: false, passed: 0 })
  expect(state.verification[0].plans).toHaveLength(2)
  expect(state.verification[0].results).toHaveLength(resultCount)
  expect(() =>
    apply(state, {
      kind: 'verification.confirm',
      workItemId: 'item',
      planVersion: 1,
      note: 'Stale'
    })
  ).toThrow('plan changed')
  expect(() =>
    apply(state, {
      kind: 'verification.plan',
      workItemId: 'item',
      expectedVersion: 1,
      scenarios: [scenario],
      note: 'Stale'
    })
  ).toThrow('plan changed')
})

it('supports discovery first, then reviewed AC and implementation without changing old prompts', () => {
  const state = fixture()
  state.workItems[0].kind = 'investigation'
  state.workItems[0].acceptanceCriteria = ''
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'item',
        roleId: 'engineer',
        title: 'Discover requirements',
        instructions: 'Draft AC and design options',
        acceptanceCriteria: 'Review proposed behavior'
      }
    },
    'discovery'
  )
  const attempt = preparePortfolioAttempt(state, 'discovery', 'workspace', 'ios', 'discovery-op', 1)
  attempt.state = 'launched'
  acceptTask(state, 'discovery')
  apply(state, { kind: 'task.closeExecution', taskId: 'discovery', note: 'Stopped' })
  const expected = PortfolioWorkItemInput.parse(state.workItems[0])
  apply(state, {
    kind: 'workItem.update',
    workItemId: 'item',
    expected,
    workItem: { ...expected, kind: 'initial', acceptanceCriteria: 'Reviewed count requirements' }
  })
  plan(state)
  confirm(state)
  expect(attempt.prompt).toContain('Not yet defined')
  expect(state.verification[0].plans[0].acceptanceCriteria).toBe('Reviewed count requirements')
  const current = PortfolioWorkItemInput.parse(state.workItems[0])
  expect(() =>
    apply(state, {
      kind: 'workItem.update',
      workItemId: 'item',
      expected: current,
      workItem: { ...current, acceptanceCriteria: 'Silently redefine' }
    })
  ).toThrow('no test plan')
})

it('backs up v2 exactly and does not treat its accepted work as verified', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-verification-migration-'))
  try {
    const state = fixture()
    state.workItems[0].status = 'accepted'
    const { verification: _verification, ...legacy } = state
    const original = JSON.stringify({
      ...legacy,
      workItems: legacyWorkItems(legacy.workItems),
      schemaVersion: 2
    })
    const file = join(directory, 'portfolio.json')
    await writeFile(file, original)
    const store = new PortfolioStore(file)
    const read = await store.read()
    expect(read.verification).toEqual([])
    expect(read.workItems[0].status).toBe('accepted')
    expect(() =>
      apply(read, { kind: 'feature.publish', workItemId: 'item', note: 'Legacy approval' })
    ).toThrow('passing evidence')
    await store.update(0, (next) =>
      apply(next, {
        kind: 'workItem.transition',
        workItemId: 'item',
        status: 'planned',
        note: 'Add verification'
      })
    )
    expect(await readFile(`${file}.v2.bak`, 'utf8')).toBe(original)
    expect((await store.read()).schemaVersion).toBe(6)
    expect((await store.read()).workItems[0].status).toBe('planned')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('allows separate fixes for both failed platforms without approving stale evidence', () => {
  const state = fixture()
  plan(state)
  confirm(state)
  const ios = record(state, 'ios', 'fail')
  const android = record(state, 'android', 'fail')
  apply(
    state,
    { kind: 'verification.fix', workItemId: 'item', resultId: ios, roleId: 'engineer' },
    'fix-ios'
  )
  expect(() => review(state, android)).toThrow('outdated')
  apply(
    state,
    { kind: 'verification.fix', workItemId: 'item', resultId: android, roleId: 'engineer' },
    'fix-android'
  )
  expect(state.tasks.map((task) => task.platform)).toEqual(['ios', 'android'])
  expect(verificationProgress(state, 'item').ready).toBe(false)
  expect(() =>
    apply(state, {
      kind: 'verification.fix',
      workItemId: 'item',
      resultId: android,
      roleId: 'engineer'
    })
  ).toThrow()
  record(state, 'android', 'blocked')
  expect(() =>
    apply(state, {
      kind: 'verification.fix',
      workItemId: 'item',
      resultId: android,
      roleId: 'engineer'
    })
  ).toThrow('outdated')
})

it('requires a fresh test plan before detaching tasks so old passing evidence cannot become current again', () => {
  const state = fixture()
  plan(state)
  confirm(state)
  review(state, record(state, 'ios'))
  review(state, record(state, 'android'))
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'item',
        roleId: 'engineer',
        title: 'Rework',
        instructions: 'Update implementation',
        acceptanceCriteria: 'Rerun scenarios'
      }
    },
    'rework'
  )
  expect(verificationProgress(state, 'item').ready).toBe(false)
  expect(() => apply(state, { kind: 'task.linkWorkItem', taskId: 'rework' })).toThrow(
    'Revise the test plan'
  )
  expect(state.tasks[0].workItemId).toBe('item')
  plan(state)
  apply(state, { kind: 'task.linkWorkItem', taskId: 'rework' })
  confirm(state)
  expect(state.tasks[0].workItemId).toBeUndefined()
  expect(verificationProgress(state, 'item').ready).toBe(false)
  expect(state.verification[0].results).toHaveLength(2)
})

it('rejects a proposal drafted against an older feature version', () => {
  const state = fixture()
  plan(state)
  confirm(state)
  review(state, record(state, 'ios'))
  review(state, record(state, 'android'))
  accept(state)
  apply(state, { kind: 'feature.publish', workItemId: 'item', note: 'Baseline 1' })
  const proposal = {
    ...PortfolioWorkItemInput.parse(state.workItems[0]),
    kind: 'improvement',
    title: 'Next change'
  }
  expect(() =>
    apply(state, { kind: 'workItem.create', workItem: proposal, expectedBaseVersion: 0 })
  ).toThrow('specification changed')
  apply(state, { kind: 'workItem.create', workItem: proposal, expectedBaseVersion: 1 }, 'proposal')
  expect(state.workItems.at(-1)?.baseVersion).toBe(1)
})

it('returns a failed result to the platform’s development task instead of creating a new one', () => {
  const state = fixture()
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'item',
        roleId: 'engineer',
        platform: 'android',
        title: 'Build counts on Android',
        instructions: 'Implement',
        acceptanceCriteria: 'Counts shown'
      }
    },
    'android-dev'
  )
  plan(state)
  confirm(state)
  const android = record(state, 'android', 'fail')
  apply(state, {
    kind: 'verification.fix',
    workItemId: 'item',
    resultId: android,
    roleId: 'engineer'
  })
  expect(state.tasks.map((task) => task.id)).toEqual(['android-dev'])
  expect(verificationProgress(state, 'item').verification?.results[0].fixTaskId).toBe('android-dev')
  const prompt = preparePortfolioAttempt(state, 'android-dev', 'w', 'android', 'op', 2).prompt
  expect(prompt).toContain(`Returned from QA: android result ${android} (fail) for scenario counts`)
})
