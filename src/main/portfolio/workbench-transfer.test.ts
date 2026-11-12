import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { expect, it } from 'vitest'
import { attachPortfolioDesign, readPortfolioDesign } from './portfolio-design-store'
import { createWorkbench, listWorkbenches, workbenchStore } from './workbench-spaces'
import { exportWorkbenchArchive, importWorkbenchArchive } from './workbench-transfer'

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII='

it('moves Workbench content and attachments to a new profile without carrying device bindings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-transfer-'))
  try {
    const source = join(root, 'source')
    const destination = join(root, 'destination')
    const archive = join(root, 'box-office.orca-workbench.zip')
    const created = await createWorkbench(source, 'Box Office')
    const store = workbenchStore(source, created.id)
    const saved = await store.update(null, (state) => {
      state.projects.push({
        id: 'project',
        name: 'Tickets',
        objective: 'Ship tickets',
        repoIds: ['source-repo']
      })
      state.features.push({
        id: 'feature',
        projectId: 'project',
        name: 'Sales',
        description: '',
        versions: []
      })
      state.workItems.push({
        id: 'outcome',
        projectId: 'project',
        featureId: 'feature',
        kind: 'initial',
        title: 'Sales report',
        description: '',
        acceptanceCriteria: 'Show sales',
        designReferences: '',
        tickets: [],
        parity: true,
        status: 'planned',
        baseVersion: 0,
        history: [],
        coordinator: { roleId: state.roles[0].id, path: '/source/coordinator', at: 1 }
      })
      state.tasks.push({
        id: 'task',
        projectId: 'project',
        roleId: state.roles[0].id,
        title: 'Build report',
        instructions: 'Build it',
        acceptanceCriteria: 'Works',
        stage: 'development',
        status: 'running',
        evidence: '',
        steps: [],
        history: [],
        attempts: [
          {
            operationId: 'operation',
            worktreeId: 'source-workspace',
            agent: 'codex',
            prompt: 'Original task prompt',
            createdAt: 1,
            state: 'launched',
            handle: 'source-handle',
            paneKey: 'source-pane',
            sessionId: 'source-session'
          }
        ]
      })
    })
    await attachPortfolioDesign(store, {
      revision: saved.revision,
      workItemId: 'outcome',
      name: 'sales.png',
      mimeType: 'image/png',
      base64: png
    })

    await exportWorkbenchArchive(source, created.id, archive)
    const result = await importWorkbenchArchive(destination, archive)
    const imported = await workbenchStore(destination, result.workbench.id).read()

    expect(result.workbench.name).toBe('Box Office')
    expect(result.workbench.id).not.toBe(created.id)
    expect(result.unlinkedProjects).toBe(1)
    expect(imported.projects[0].repoIds).toEqual([])
    expect(imported.tasks[0].status).toBe('todo')
    expect(imported.tasks[0].attempts[0]).toMatchObject({
      prompt: 'Original task prompt',
      worktreeId: 'unlinked',
      state: 'closed'
    })
    expect(imported.tasks[0].attempts[0]).not.toHaveProperty('handle')
    expect(imported.tasks[0].attempts[0]).not.toHaveProperty('paneKey')
    expect(imported.tasks[0].attempts[0]).not.toHaveProperty('sessionId')
    expect(imported.workItems[0]).not.toHaveProperty('coordinator')
    expect(
      (
        await readPortfolioDesign(
          workbenchStore(destination, result.workbench.id),
          imported.workItems[0].designAttachments![0].id
        )
      ).base64
    ).toBe(png)
    expect((await store.read()).projects[0].repoIds).toEqual(['source-repo'])

    const files = unzipSync(await readFile(archive))
    const invalid = join(root, 'invalid.zip')
    await writeFile(invalid, zipSync({ ...files, '../outside.txt': strToU8('bad') }))
    await expect(importWorkbenchArchive(destination, invalid)).rejects.toThrow('unexpected file')
    expect(await listWorkbenches(destination)).toHaveLength(2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('exports the built-in workbench before it has saved a portfolio file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-transfer-'))
  try {
    const archive = join(root, 'default.orca-workbench.zip')
    await exportWorkbenchArchive(join(root, 'source'), 'default', archive)
    const imported = await importWorkbenchArchive(join(root, 'destination'), archive)
    expect(imported.workbench.id).not.toBe('default')
    expect(
      (await workbenchStore(join(root, 'destination'), imported.workbench.id).read()).projects
    ).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
