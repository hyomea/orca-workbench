import { afterEach, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectPortfolioSourceContext } from './portfolio-source-context'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

it('samples project evidence while excluding ignored, hidden, dependency, and external files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-discovery-context-'))
  directories.push(root)
  const project = join(root, 'project')
  for (const folder of ['docs', 'src', 'node_modules', 'secrets']) {
    await mkdir(join(project, folder), { recursive: true })
  }
  const files = {
    'README.md': 'An exploration hub for the arts.',
    'package.json': '{"name":"arts-hub"}',
    'src/index.ts': 'export const purpose = "explore"',
    'docs/vision.md': 'a'.repeat(5000),
    '.gitignore': 'docs/private.md\n',
    'docs/private.md': 'ignored-marker',
    '.env': 'hidden-marker',
    'node_modules/README.md': 'dependency-marker',
    'secrets/README.md': 'secret-marker'
  }
  await Promise.all(
    Object.entries(files).map(([path, text]) => writeFile(join(project, path), text))
  )
  await writeFile(join(root, 'outside.md'), 'external-marker')
  await symlink(join(root, 'outside.md'), join(project, 'docs', 'external.md'))
  const result = await collectPortfolioSourceContext(
    [{ name: 'Arts', path: project }],
    new AbortController().signal
  )
  expect(result.sources).toContain('Arts/README.md')
  expect(result.context).toContain('exploration hub')
  for (const marker of [
    'ignored-marker',
    'hidden-marker',
    'dependency-marker',
    'secret-marker',
    'external-marker'
  ]) {
    expect(result.context).not.toContain(marker)
  }
  expect(result.limited).toBe(true)
  expect(result.context).toContain('[excerpt truncated]')
  expect(await readFile(join(project, 'docs/vision.md'), 'utf8')).toHaveLength(5000)
})

it('rejects canceled scans before reading any directories', async () => {
  const controller = new AbortController()
  controller.abort(new Error('Stopped'))
  await expect(
    collectPortfolioSourceContext([{ name: 'Unused', path: '/missing' }], controller.signal)
  ).rejects.toThrow('Stopped')
})
