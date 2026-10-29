import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PortfolioStore } from './portfolio-store'
import { applyPortfolioCommand, portfolioProgress } from '../../shared/portfolio'
import { launchPortfolioTask, portfolioExecutionInFlight } from './portfolio-execution'
import type { AgentLaunchResult } from '../../shared/agent-launch-intent'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function fixture(): Promise<{ store: PortfolioStore; file: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'orca-portfolio-'))
  directories.push(directory)
  const file = join(directory, 'portfolio.json')
  const store = new PortfolioStore(file)
  await store.update(0, (state) => {
    applyPortfolioCommand(
      state,
      {
        kind: 'project.create',
        project: { name: 'Identity', objective: 'Unify sign in', repoIds: ['api', 'mobile'] }
      },
      'project',
      1
    )
    applyPortfolioCommand(
      state,
      {
        kind: 'role.create',
        role: { name: 'Engineer', responsibility: 'Implement and verify changes', agent: 'codex' }
      },
      'role',
      2
    )
    applyPortfolioCommand(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          roleId: 'role',
          title: 'Session contract',
          instructions: 'Implement the contract',
          acceptanceCriteria: 'Contract tests pass'
        }
      },
      'task',
      3
    )
  })
  return { store, file }
}

function receipt(): AgentLaunchResult {
  return {
    outcome: { kind: 'terminal', handle: 'terminal', paneKey: 'tab:leaf' },
    worktreeId: 'workspace',
    prompt: { delivery: 'submit', outcome: 'handed-to-terminal' },
    receipt: {
      mode: 'terminal',
      preferred: 'terminal',
      reason: 'user_default',
      detail: 'Terminal default'
    }
  }
}

describe('portfolio persistence and execution', () => {
  it('refuses a second window while the original launch is still in flight', async () => {
    const { store, file } = await fixture()
    const started = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    const first = launchPortfolioTask(
      store,
      { revision: 1, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
      async () => {
        started.resolve()
        await finish.promise
        return receipt()
      }
    )
    await started.promise
    try {
      const other = new PortfolioStore(file)
      const pending = await other.read()
      expect(portfolioExecutionInFlight(other, 'task')).toBe(true)
      await expect(
        launchPortfolioTask(
          other,
          { revision: pending.revision, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
          async () => receipt()
        )
      ).rejects.toThrow('already starting')
      expect((await other.read()).revision).toBe(pending.revision)
      expect((await other.read()).tasks[0].attempts).toHaveLength(1)
    } finally {
      finish.resolve()
      await first
    }
    expect(portfolioExecutionInFlight(store, 'task')).toBe(false)
  })

  it('serializes writers across store instances and rejects stale writes without losing data', async () => {
    const { store, file } = await fixture()
    const other = new PortfolioStore(file)
    const results = await Promise.allSettled([
      store.update(1, (state) => {
        state.organization = 'First'
      }),
      other.update(1, (state) => {
        state.organization = 'Second'
      })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const state = await other.read()
    expect(state.revision).toBe(2)
    expect(state.tasks).toHaveLength(1)
  })

  it('preserves corrupt or newer-version data instead of replacing it', async () => {
    const { store, file } = await fixture()
    const newer = JSON.stringify({ ...(await store.read()), schemaVersion: 2 })
    for (const contents of ['{broken', newer]) {
      await writeFile(file, contents)
      await expect(
        store.update(null, (state) => {
          state.organization = 'Replacement'
        })
      ).rejects.toThrow('preserved')
      expect(await readFile(file, 'utf8')).toBe(contents)
    }
  })

  it('recovers an ambiguous launch with the original intent after reopening the store', async () => {
    const { store, file } = await fixture()
    const first = await launchPortfolioTask(
      store,
      { revision: 1, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
      async () => {
        throw new Error('Connection lost after dispatch')
      }
    )
    const original = first.tasks[0].attempts[0]
    expect(original.state).toBe('unknown')
    let replayId = ''
    let replayPrompt = ''
    const recovered = await launchPortfolioTask(
      new PortfolioStore(file),
      { revision: first.revision, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
      async (attempt) => {
        replayId = attempt.operationId
        replayPrompt = attempt.prompt
        return receipt()
      }
    )
    expect(replayId).toBe(original.operationId)
    expect(replayPrompt).toBe(original.prompt)
    expect(recovered.tasks[0].attempts).toHaveLength(1)
    expect(recovered.tasks[0].attempts[0].handle).toBe('terminal')
    expect(portfolioProgress(recovered.tasks).percent).toBe(0)
    await expect(
      store.update(recovered.revision, (state) =>
        applyPortfolioCommand(
          state,
          { kind: 'task.transition', taskId: 'task', status: 'accepted', note: 'Done' },
          '',
          4
        )
      )
    ).rejects.toThrow('evidence')
    const review = await store.update(recovered.revision, (state) =>
      applyPortfolioCommand(
        state,
        {
          kind: 'task.transition',
          taskId: 'task',
          status: 'review',
          note: 'Contract suite passed; PR #42'
        },
        '',
        5
      )
    )
    const accepted = await store.update(review.revision, (state) =>
      applyPortfolioCommand(
        state,
        {
          kind: 'task.transition',
          taskId: 'task',
          status: 'accepted',
          note: 'Reviewed contract and results'
        },
        '',
        6
      )
    )
    expect(portfolioProgress(accepted.tasks).percent).toBe(100)
    expect(accepted.tasks[0].evidence).toContain('PR #42')
    const closed = await store.update(accepted.revision, (state) =>
      applyPortfolioCommand(
        state,
        { kind: 'task.closeExecution', taskId: 'task', note: 'Stopped the session after review' },
        '',
        7
      )
    )
    expect(portfolioProgress(closed.tasks).percent).toBe(100)
    expect(closed.tasks[0].evidence).toContain('PR #42')
  })

  it('rejects unrelated repositories and prevents replacing a live execution', async () => {
    const { store } = await fixture()
    let launches = 0
    const launch = async (): Promise<AgentLaunchResult> => {
      launches += 1
      return receipt()
    }
    await expect(
      launchPortfolioTask(
        store,
        { revision: 1, taskId: 'task', worktreeId: 'workspace', repoId: 'unrelated' },
        launch
      )
    ).rejects.toThrow('linked')
    expect(launches).toBe(0)
    const running = await launchPortfolioTask(
      store,
      { revision: 1, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
      launch
    )
    const reopened = await store.update(running.revision, (state) =>
      applyPortfolioCommand(
        state,
        { kind: 'task.transition', taskId: 'task', status: 'todo', note: 'More work required' },
        '',
        4
      )
    )
    await expect(
      launchPortfolioTask(
        store,
        { revision: reopened.revision, taskId: 'task', worktreeId: 'workspace', repoId: 'api' },
        launch
      )
    ).rejects.toThrow('Stop and close')
    expect(launches).toBe(1)
  })
})
