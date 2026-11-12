import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  createWorkbench,
  listWorkbenches,
  removeWorkbench,
  workbenchStore
} from './workbench-spaces'

let userData = ''
afterEach(() => rm(userData, { recursive: true, force: true }))

it('starts a new workbench with the outcome coordinator role and nothing else', async () => {
  userData = await mkdtemp(join(tmpdir(), 'workbench-spaces-'))
  const created = await createWorkbench(userData, 'Box Office')
  const state = await workbenchStore(userData, created.id).read()
  expect(state.organization).toBe('Box Office')
  expect(state.roles).toHaveLength(1)
  expect(state.roles[0]).toMatchObject({ name: 'Outcome coordinator', coordinator: true })
})

it('removes a named workbench and its files while preserving the default workbench', async () => {
  userData = await mkdtemp(join(tmpdir(), 'workbench-spaces-'))
  const created = await createWorkbench(userData, 'Box Office')
  const directory = join(userData, 'workbench', 'spaces', created.id)
  await mkdir(join(directory, 'steward'), { recursive: true })
  await writeFile(join(directory, 'steward', 'note.txt'), 'private data')
  await removeWorkbench(userData, created.id)

  expect((await listWorkbenches(userData)).map((entry) => entry.id)).toEqual(['default'])
  await expect(readFile(join(directory, 'steward', 'note.txt'))).rejects.toMatchObject({
    code: 'ENOENT'
  })
  await expect(removeWorkbench(userData, '../default')).rejects.toThrow()
})

it('clears the default workbench without removing named workbenches or shared notes settings', async () => {
  userData = await mkdtemp(join(tmpdir(), 'workbench-spaces-'))
  const root = join(userData, 'workbench')
  const created = await createWorkbench(userData, 'Box Office')
  await writeFile(join(root, 'portfolio.json'), '{}')
  await writeFile(join(root, 'portfolio.json.v1.bak'), 'backup')
  await writeFile(join(root, 'personal-notes.json'), '{"folder":"/notes"}')
  await mkdir(join(root, 'steward'))
  await writeFile(join(root, 'steward', 'steward-notes.md'), 'Global instructions')
  await mkdir(join(root, 'design-attachments'))
  await writeFile(join(root, 'design-attachments', 'image.png'), 'image')

  await removeWorkbench(userData, 'default')

  expect((await listWorkbenches(userData)).map((entry) => entry.id)).toEqual([
    'default',
    created.id
  ])
  await expect(readFile(join(root, 'portfolio.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(readFile(join(root, 'portfolio.json.v1.bak'))).rejects.toMatchObject({
    code: 'ENOENT'
  })
  await expect(readFile(join(root, 'design-attachments', 'image.png'))).rejects.toMatchObject({
    code: 'ENOENT'
  })
  expect(await readFile(join(root, 'personal-notes.json'), 'utf8')).toBe('{"folder":"/notes"}')
  expect(await readFile(join(root, 'steward', 'steward-notes.md'), 'utf8')).toBe(
    'Global instructions'
  )
})
