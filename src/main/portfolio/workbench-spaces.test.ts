import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createWorkbench, workbenchStore } from './workbench-spaces'

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
