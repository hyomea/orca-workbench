import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { applyPortfolioCommand, emptyPortfolio } from '../../shared/portfolio'
import { applyPortfolioBatch } from '../../shared/portfolio-batch'
import { PortfolioStore } from './portfolio-store'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

function ids() {
  let next = 0
  return () => `id${++next}`
}

const plan = [
  {
    ref: 'feature',
    command: {
      kind: 'feature.create',
      feature: { projectId: 'p', name: 'Testing foundation', description: '' }
    }
  },
  {
    ref: 'item',
    command: {
      kind: 'workItem.create',
      workItem: {
        featureId: '$ref:feature',
        kind: 'improvement',
        title: 'Android foundation',
        description: 'ENG-5952',
        acceptanceCriteria: 'Unit tests pass',
        designReferences: '',
        sourceReference: 'https://example.atlassian.net/browse/ENG-5952'
      }
    }
  },
  {
    ref: 'role',
    command: {
      kind: 'role.create',
      role: { name: 'Android Engineer', responsibility: 'Build', agent: 'claude' }
    }
  },
  {
    command: {
      kind: 'task.create',
      task: {
        projectId: 'p',
        roleId: '$ref:role',
        workItemId: '$ref:item',
        title: 'Port foundation',
        instructions: 'Port the branch',
        acceptanceCriteria: 'Tests pass',
        platform: 'android'
      }
    }
  }
]

function project() {
  const state = emptyPortfolio()
  applyPortfolioCommand(
    state,
    { kind: 'project.create', project: { name: 'Ludus', objective: 'Parity', repoIds: [] } },
    'p',
    1
  )
  return state
}

it('creates linked records in one batch through the regular command rules', () => {
  const state = project()
  const refs = applyPortfolioBatch(state, plan, ids(), 5)
  expect(refs).toEqual({ feature: 'id1', item: 'id2', role: 'id3' })
  expect(state.workItems[0]).toMatchObject({ featureId: 'id1', status: 'planned' })
  expect(state.tasks[0]).toMatchObject({
    id: 'id4',
    roleId: 'id3',
    workItemId: 'id2',
    status: 'todo',
    platform: 'android'
  })
})

it('names the failing step and rejects unknown or duplicate refs', () => {
  expect(() => applyPortfolioBatch(project(), [plan[1]], ids(), 5)).toThrow(
    'Step 1 (workItem.create): Unknown ref "feature"'
  )
  expect(() =>
    applyPortfolioBatch(project(), [plan[0], { ...plan[2], ref: 'feature' }], ids(), 5)
  ).toThrow('ref "feature" is already used')
  expect(() =>
    applyPortfolioBatch(
      project(),
      [plan[0], { command: { kind: 'task.create', task: { projectId: 'p' } } }],
      ids(),
      5
    )
  ).toThrow(/^Step 2 \(task.create\):/)
})

it('writes nothing when any step fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-batch-'))
  directories.push(directory)
  const store = new PortfolioStore(join(directory, 'portfolio.json'))
  await store.update(0, (state) => Object.assign(state, project()))
  const before = await store.read()
  const broken = [
    ...plan.slice(0, 3),
    { command: { ...plan[3].command, task: { ...plan[3].command.task, roleId: 'missing' } } }
  ]
  await expect(
    store.update(null, (state) => {
      applyPortfolioBatch(state, broken, ids(), 5)
    })
  ).rejects.toThrow('Step 4 (task.create): Choose an existing project and role.')
  expect(await store.read()).toEqual(before)
})
