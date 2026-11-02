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

it('reads agent instructions first and keeps a large early directory from starving later ones', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-discovery-share-'))
  directories.push(root)
  const large = join(root, 'large')
  const small = join(root, 'small')
  await mkdir(join(large, 'docs'), { recursive: true })
  await mkdir(join(small, 'src', 'vendor-widget'), { recursive: true })
  await writeFile(join(large, 'README.md'), 'r'.repeat(20000))
  for (let index = 0; index < 30; index += 1) {
    await writeFile(join(large, 'docs', `guide-${index}.md`), 'd'.repeat(20000))
  }
  await writeFile(join(small, 'README.md'), 'small-readme-marker')
  await writeFile(join(small, 'CLAUDE.md'), 'small-agent-marker')
  await writeFile(join(small, 'src', 'vendor-widget', 'README.md'), 'vendored-marker')
  const result = await collectPortfolioSourceContext(
    [
      { name: 'Large', path: large },
      { name: 'Small', path: small }
    ],
    new AbortController().signal
  )
  const smallSources = result.sources.filter((source) => source.startsWith('Small/'))
  expect(smallSources.slice(0, 2).sort()).toEqual(['Small/CLAUDE.md', 'Small/README.md'])
  expect(smallSources.indexOf('Small/src/vendor-widget/README.md')).toBeGreaterThan(1)
  expect(result.context).toContain('small-agent-marker')
  expect(result.sources.filter((source) => source.startsWith('Large/')).length).toBeLessThanOrEqual(
    12
  )
})

it('rejects canceled scans before reading any directories', async () => {
  const controller = new AbortController()
  controller.abort(new Error('Stopped'))
  await expect(
    collectPortfolioSourceContext([{ name: 'Unused', path: '/missing' }], controller.signal)
  ).rejects.toThrow('Stopped')
})
