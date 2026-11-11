import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  PortfolioCommand,
  preparePortfolioAttempt
} from '../../shared/portfolio'
import { createWorkbench, workbenchStore } from './workbench-spaces'
import { prepareOutcomeCoordinator } from './portfolio-outcome-coordinator'

let userData = ''
afterEach(() => rm(userData, { recursive: true, force: true }))

async function workbench() {
  userData = await mkdtemp(join(tmpdir(), 'outcome-coordinator-'))
  const { id } = await createWorkbench(userData, 'Box Office')
  const store = workbenchStore(userData, id)
  await store.update(null, (state) => {
    const apply = (command: unknown, at: string) =>
      applyPortfolioCommand(state, PortfolioCommand.parse(command), at, 1)
    apply(
      { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: ['ios'] } },
      'project'
    )
    apply(
      {
        kind: 'role.create',
        role: { name: 'iOS Engineer', agentName: 'Sisi', agent: 'claude', responsibility: 'Build' }
      },
      'sisi'
    )
    apply(
      {
        kind: 'workItem.create',
        workItem: {
          projectId: 'project',
          kind: 'engineering',
          title: 'Upload signatures through the API',
          description: '',
          acceptanceCriteria: '- No retry',
          designReferences: '',
          tickets: [{ platform: 'ios', reference: 'ENG-8250' }],
          parity: false
        }
      },
      'outcome'
    )
    apply(
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          roleId: 'sisi',
          platform: 'ios',
          title: 'iOS development',
          instructions: 'Build it',
          acceptanceCriteria: 'Done'
        }
      },
      'task'
    )
  })
  return store
}

it('writes the outcome coordinator its own folder and records the hand-off', async () => {
  const store = await workbench()
  const { path, agent } = await prepareOutcomeCoordinator(store, 'outcome', 'orca-dev')
  expect(agent).toBe('claude')
  expect(basename(path)).toBe('upload-signatures-through-the-api')
  const instructions = await readFile(join(path, 'CLAUDE.md'), 'utf8')
  expect(instructions).toContain('- Outcome: Upload signatures through the API (`outcome`)')
  expect(instructions).toContain("Run Orca's CLI as `orca-dev`")
  expect(instructions).toContain('ORCA workbench status --project project')
  expect(instructions).toContain('run `task start` only after the user says yes')
  expect(await readFile(join(path, 'AGENTS.md'), 'utf8')).toBe(instructions)
  const settings = JSON.parse(await readFile(join(path, '.claude', 'settings.json'), 'utf8'))
  expect(settings.permissions.allow).toContain('Bash(orca-dev workbench:*)')
  // Messaging an agent, a review looking again, and starting a task always ask the user.
  expect(settings.permissions.ask).toEqual(
    expect.arrayContaining([
      'Bash(orca-dev workbench task message:*)',
      'Bash(orca-dev workbench task again:*)',
      'Bash(orca-dev workbench task start:*)'
    ])
  )
  const state = await store.read()
  const item = state.workItems[0]
  expect(item.coordinator).toMatchObject({ path, roleId: state.roles[0].id })
  expect(item.history.at(-1)?.note).toBe('Handed over to Outcome coordinator')
  // Starting it again reopens the same folder without another hand-off entry.
  await prepareOutcomeCoordinator(store, 'outcome', 'orca-dev')
  expect(
    (await store.read()).workItems[0].history.filter((entry) =>
      entry.note.startsWith('Handed over')
    )
  ).toHaveLength(1)
  // Task agents on the outcome are told who coordinates it.
  const next = await store.read()
  expect(preparePortfolioAttempt(next, 'task', 'w', 'ios', 'op', 2).prompt).toContain(
    'Outcome coordinator: Outcome coordinator coordinates this outcome'
  )
})

it('needs the Outcome coordinator role, and leaves nothing behind without it', async () => {
  const store = await workbench()
  await store.update(null, (state) => {
    state.roles = state.roles.filter((role) => !role.coordinator)
  })
  await expect(prepareOutcomeCoordinator(store, 'outcome', 'orca')).rejects.toThrow(
    'Add the Outcome coordinator role'
  )
  expect((await store.read()).workItems[0].coordinator).toBeUndefined()
})
