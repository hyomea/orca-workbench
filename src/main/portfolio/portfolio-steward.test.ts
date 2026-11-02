import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { PortfolioStore } from './portfolio-store'
import { preparePortfolioSteward } from './portfolio-steward'

it('refreshes the steward instructions and keeps the user’s own notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-steward-'))
  try {
    const store = new PortfolioStore(join(directory, 'workbench', 'portfolio.json'))
    const { path } = await preparePortfolioSteward(store)
    expect(path).toBe(join(directory, 'workbench', 'steward'))
    await writeFile(join(path, 'CLAUDE.md'), 'stale')
    await writeFile(join(path, 'steward-notes.md'), 'Prefer Codex for reviews.')
    await preparePortfolioSteward(store)
    const instructions = await readFile(join(path, 'CLAUDE.md'), 'utf8')
    expect(instructions).toContain('@steward-notes.md')
    expect(instructions).toContain('workbench apply')
    expect(await readFile(join(path, 'steward-notes.md'), 'utf8')).toBe('Prefer Codex for reviews.')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
