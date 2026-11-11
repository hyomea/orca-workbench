import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { PortfolioStore } from './portfolio-store'
import { applyPortfolioCommand, PortfolioCommand } from '../../shared/portfolio'
import { preparePortfolioSteward, refreshPortfolioSteward } from './portfolio-steward'
import { setPersonalNotesFolder } from './personal-notes'

it('refreshes the steward instructions and keeps the user’s own notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-steward-'))
  try {
    const store = new PortfolioStore(join(directory, 'workbench', 'portfolio.json'))
    const { path } = await preparePortfolioSteward(store)
    expect(path).toBe(join(directory, 'workbench', 'steward'))
    await writeFile(join(path, 'CLAUDE.md'), 'stale')
    await writeFile(join(path, 'steward-notes.md'), 'Prefer Codex for reviews.')
    await preparePortfolioSteward(store, 'orca-dev')
    const instructions = await readFile(join(path, 'CLAUDE.md'), 'utf8')
    expect(instructions).toContain('@steward-notes.md')
    expect(instructions).toContain('workbench apply')
    // The allow rules match the bare command, never $ORCA_CLI_COMMAND or a full path.
    expect(instructions).toContain("Run Orca's CLI as `orca-dev`, by that bare name")
    expect(instructions).toContain('do not\nuse `$ORCA_CLI_COMMAND`')
    expect(await readFile(join(path, 'steward-notes.md'), 'utf8')).toBe('Prefer Codex for reviews.')
    const settings = JSON.parse(await readFile(join(path, '.claude', 'settings.json'), 'utf8'))
    expect(settings.permissions.allow).toContain('Bash(orca-dev workbench:*)')
    expect(settings.permissions.allow).toContain('Bash(orca terminal read:*)')
    expect(settings.permissions.allow.some((rule: string) => rule.includes('terminal send'))).toBe(
      false
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('points the steward at the personal notes folder once one is chosen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-steward-'))
  try {
    const store = new PortfolioStore(join(directory, 'workbench', 'portfolio.json'))
    const { path } = await preparePortfolioSteward(store)
    expect(await readFile(join(path, 'CLAUDE.md'), 'utf8')).toContain(
      'has not chosen a personal notes folder'
    )
    const notes = join(directory, 'notes')
    await mkdir(notes)
    await setPersonalNotesFolder(store, notes)
    await preparePortfolioSteward(store)
    expect(await readFile(join(path, 'CLAUDE.md'), 'utf8')).toContain(`in \`${notes}\``)
    const settings = JSON.parse(await readFile(join(path, '.claude', 'settings.json'), 'utf8'))
    expect(settings.permissions.additionalDirectories).toEqual([notes])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('introduces the steward by the name the user gave it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-steward-'))
  try {
    const store = new PortfolioStore(join(directory, 'workbench', 'portfolio.json'))
    const { path } = await preparePortfolioSteward(store)
    expect(await readFile(join(path, 'CLAUDE.md'), 'utf8')).not.toContain('Your name is')
    await store.update(0, (state) =>
      applyPortfolioCommand(
        state,
        PortfolioCommand.parse({ kind: 'steward.rename', name: 'Coco' }),
        'rename',
        1
      )
    )
    await preparePortfolioSteward(store)
    expect(await readFile(join(path, 'CLAUDE.md'), 'utf8')).toContain(
      '## Role\n\nYour name is Coco. The user also calls you the workbench coordinator.\n\nYou are the user'
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('refreshes an existing steward folder at startup and leaves a missing one alone', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-steward-'))
  try {
    const store = new PortfolioStore(join(directory, 'workbench', 'portfolio.json'))
    await refreshPortfolioSteward(store, 'orca-dev')
    await expect(readFile(join(directory, 'workbench', 'steward', 'CLAUDE.md'))).rejects.toThrow()
    const { path } = await preparePortfolioSteward(store, 'orca')
    await writeFile(join(path, 'CLAUDE.md'), 'stale')
    await refreshPortfolioSteward(store, 'orca-dev')
    expect(await readFile(join(path, 'CLAUDE.md'), 'utf8')).toContain(
      "Run Orca's CLI as `orca-dev`"
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
