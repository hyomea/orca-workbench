import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  preparePortfolioAttempt
} from '../../shared/portfolio'
import { portfolioNextStep } from '../../shared/portfolio-next-step'
import { verificationTaskSnapshot } from '../../shared/portfolio-verification'
import { PortfolioWorkItemInput } from '../../shared/portfolio-features'
import { PortfolioStore } from './portfolio-store'
import {
  attachPortfolioDesign,
  readPortfolioDesign,
  removePortfolioDesign,
  portfolioDesignPath,
  portfolioDesignPrompt
} from './portfolio-design-store'

import { portfolioTicketsText } from '../../shared/portfolio-features'
import type { PortfolioState } from '../../shared/portfolio'
// Work items as schema 5 and earlier stored them: under a feature, with one source reference.
function legacyWorkItems(items: PortfolioState['workItems']) {
  return items.map(({ projectId: _projectId, tickets, parity: _parity, ...item }) => ({
    ...item,
    sourceReference: portfolioTicketsText(tickets)
  }))
}

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII='
function fixture() {
  const state = emptyPortfolio()
  state.projects.push({ id: 'p', name: 'Mobile', objective: 'Parity', repoIds: ['repo'] })
  state.roles.push({ id: 'role', name: 'QA', responsibility: 'Verify', agent: 'codex' })
  state.features.push({ id: 'f', projectId: 'p', name: 'Reports', description: '', versions: [] })
  state.workItems.push({
    id: 'w',
    projectId: 'p',
    featureId: 'f',
    kind: 'initial',
    title: 'Counts',
    description: '',
    acceptanceCriteria: 'Show counts',
    designReferences: '',
    tickets: [],
    parity: true,
    status: 'planned',
    baseVersion: 0,
    history: []
  })
  return state
}

it('preserves screenshots through publication, inheritance, removal, restart, and replay', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-design-'))
  try {
    const store = new PortfolioStore(join(directory, 'portfolio.json'))
    await store.update(0, (state) => Object.assign(state, fixture()))
    let state = await attachPortfolioDesign(store, {
      revision: 1,
      workItemId: 'w',
      name: '../counts.png',
      mimeType: 'image/png',
      base64: png
    })
    const attachment = state.workItems[0].designAttachments![0]
    expect(attachment.name).toBe('counts.png')
    expect((await readPortfolioDesign(store, attachment.id)).base64).toBe(png)
    const command = (value: unknown, id = 'id') =>
      applyPortfolioCommand(state, PortfolioCommand.parse(value), id, 1)
    const next = () => portfolioNextStep(state, state.features[0], state.workItems[0])
    expect(next()).toBe('plan')
    command({
      kind: 'verification.plan',
      workItemId: 'w',
      expectedVersion: 0,
      note: 'Cover AC',
      scenarios: [
        {
          id: 's',
          criterion: 'Counts',
          steps: 'Open report',
          testData: '5 sold',
          expected: 'Show 5 sold',
          platformNotes: ''
        }
      ]
    })
    expect(next()).toBe('confirm')
    expect(state.verification[0].plans[0].designAttachments).toEqual([attachment])
    await store.update(state.revision, (saved) => Object.assign(saved, state))
    await expect(
      removePortfolioDesign(store, { revision: 3, workItemId: 'w', attachmentId: attachment.id })
    ).rejects.toThrow('frozen context')
    state = await store.read()
    command({ kind: 'verification.confirm', workItemId: 'w', planVersion: 1, note: 'Checked' })
    expect(next()).toBe('verify')
    for (const platform of ['ios', 'android']) {
      command(
        {
          kind: 'verification.record',
          workItemId: 'w',
          planVersion: 1,
          expectedTaskSnapshot: verificationTaskSnapshot(state, 'w'),
          result: {
            scenarioId: 's',
            platform,
            outcome: 'pass',
            build: '1',
            environment: 'simulator',
            evidence: 'Observed 5'
          }
        },
        platform
      )
      command({
        kind: 'verification.review',
        workItemId: 'w',
        resultId: platform,
        decision: 'approved',
        note: 'Reviewed'
      })
    }
    expect(next()).toBe('review')
    command({ kind: 'workItem.transition', workItemId: 'w', status: 'accepted', note: 'Accepted' })
    expect(next()).toBe('publish')
    command({ kind: 'feature.publish', workItemId: 'w', note: 'Baseline' })
    expect(next()).toBe('published')
    command(
      {
        kind: 'workItem.create',
        expectedBaseVersion: 1,
        workItem: { ...PortfolioWorkItemInput.parse(state.workItems[0]), kind: 'improvement' }
      },
      'followup'
    )
    await store.update(state.revision, (saved) => Object.assign(saved, state))
    state = await store.read()
    expect(state.workItems[1].designAttachments).toEqual([attachment])
    state = await removePortfolioDesign(store, {
      revision: state.revision,
      workItemId: 'followup',
      attachmentId: attachment.id
    })
    expect(state.features[0].versions[0].designAttachments).toEqual([attachment])
    expect((await readPortfolioDesign(store, attachment.id)).base64).toBe(png)
    command(
      {
        kind: 'task.create',
        task: {
          projectId: 'p',
          roleId: 'role',
          workItemId: 'followup',
          title: 'Implement',
          instructions: 'Update counts',
          acceptanceCriteria: 'Matches design'
        }
      },
      'task'
    )
    const context = portfolioDesignPrompt(store, state, 'task')
    expect(context).toContain(portfolioDesignPath(store, attachment))
    const attempt = preparePortfolioAttempt(
      state,
      'task',
      'workspace',
      'repo',
      'operation',
      1,
      context
    )
    const originalPrompt = attempt.prompt
    attempt.state = 'unknown'
    expect(
      preparePortfolioAttempt(state, 'task', 'workspace', 'repo', 'retry', 2, 'changed context')
        .prompt
    ).toBe(originalPrompt)
    await store.update(state.revision, (saved) => Object.assign(saved, state))
    expect((await new PortfolioStore(store.file).read()).tasks[0].attempts[0].prompt).toBe(
      originalPrompt
    )
    await writeFile(portfolioDesignPath(store, attachment), 'tampered')
    await expect(readPortfolioDesign(store, attachment.id)).rejects.toThrow('changed on disk')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('backs up v3 and rejects stale, invalid, oversized, or unknown image requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-design-migration-'))
  try {
    const store = new PortfolioStore(join(directory, 'portfolio.json'))
    const current = fixture()
    const legacy = JSON.stringify({
      ...current,
      workItems: legacyWorkItems(current.workItems),
      schemaVersion: 3
    })
    await writeFile(store.file, legacy)
    const request = {
      revision: 0,
      workItemId: 'w',
      name: 'design.png',
      mimeType: 'image/png',
      base64: png
    }
    await expect(attachPortfolioDesign(store, { ...request, revision: 1 })).rejects.toThrow(
      'changed'
    )
    await expect(
      attachPortfolioDesign(store, { ...request, mimeType: 'image/jpeg' })
    ).rejects.toThrow('matching')
    await expect(attachPortfolioDesign(store, { ...request, base64: 'invalid!' })).rejects.toThrow(
      'encoding'
    )
    await expect(
      attachPortfolioDesign(store, { ...request, base64: 'A'.repeat(6990512) })
    ).rejects.toThrow('5 MiB')
    await expect(readPortfolioDesign(store, '../../portfolio.json')).rejects.toThrow('not found')
    await attachPortfolioDesign(store, request)
    expect(await readFile(`${store.file}.v3.bak`, 'utf8')).toBe(legacy)
    expect((await store.read()).schemaVersion).toBe(6)
    expect(JSON.parse(await readFile(store.file, 'utf8')).schemaVersion).toBe(6)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
