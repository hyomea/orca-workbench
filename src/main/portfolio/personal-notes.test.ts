import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { PortfolioStore } from './portfolio-store'
import {
  indexPersonalNotes,
  personalNotesPrompt,
  scanPersonalNotes,
  setPersonalNotesFolder
} from './personal-notes'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'orca-personal-notes-'))
  directories.push(root)
  const folder = join(root, 'notes')
  await mkdir(join(folder, 'review'), { recursive: true })
  await mkdir(join(folder, '.git'))
  await writeFile(
    join(folder, 'review', 'android.md'),
    '---\nsummary: How to review Android PRs\napplies: [android-box-office]\nagents: all\n---\n# Android review checklist\n'
  )
  await writeFile(
    join(folder, 'review', 'ios.md'),
    '---\napplies: ios-box-office\nagents: all\n---\n# iOS review checklist\n'
  )
  await writeFile(join(folder, 'adb.md'), '# ADB guide\nNo front matter.\n')
  await writeFile(join(folder, 'private.md'), '---\nagents: none\n---\n# Private\n')
  await writeFile(join(folder, 'broken.md'), '---\nagents: everyone\n---\n# Broken\n')
  const store = new PortfolioStore(join(root, 'workbench', 'portfolio.json'))
  await mkdir(join(root, 'workbench'))
  await setPersonalNotesFolder(store, folder)
  return { folder, store }
}

it('reads categories and front matter, defaulting notes to the steward', async () => {
  const { folder } = await setup()
  const notes = await scanPersonalNotes(folder)
  expect(notes.map((note) => [note.relativePath, note.category, note.agents])).toEqual([
    ['adb.md', '', 'steward'],
    ['broken.md', '', 'steward'],
    ['private.md', '', 'none'],
    ['review/android.md', 'review', 'all'],
    ['review/ios.md', 'review', 'all']
  ])
  expect(notes[3]).toMatchObject({
    title: 'Android review checklist',
    summary: 'How to review Android PRs',
    applies: ['android-box-office']
  })
  expect(notes[4].applies).toEqual(['ios-box-office'])
  expect(notes[1].problem).toMatch(/agents/)
})

it('writes the index only when it changes and leaves it out of the notes', async () => {
  const { folder, store } = await setup()
  const first = await indexPersonalNotes(store)
  expect(first.git).toBe(true)
  const index = await readFile(first.indexPath, 'utf8')
  expect(index).toContain('## General')
  expect(index).toContain(
    '- [Android review checklist](review/android.md) — How to review Android PRs · applies: android-box-office · agents: all'
  )
  expect(index).toContain('⚠ Front matter')
  expect(index).toMatch(/\n\n## review\n\n/)
  const written = (await stat(first.indexPath)).mtimeMs
  const second = await indexPersonalNotes(store)
  expect(second.notes.map((note) => note.relativePath)).not.toContain('INDEX.md')
  expect((await stat(join(folder, 'INDEX.md'))).mtimeMs).toBe(written)
})

it('gives a task agent only open notes for its repository', async () => {
  const { folder, store } = await setup()
  const prompt = await personalNotesPrompt(store, {
    path: '/Users/me/dev/android-box-office',
    displayName: 'Android'
  })
  expect(prompt).toContain(join(folder, 'review', 'android.md'))
  for (const hidden of ['ios.md', 'adb.md', 'private.md', 'broken.md']) {
    expect(prompt).not.toContain(hidden)
  }
  expect(await personalNotesPrompt(store, null)).toBe('')
})

it('rejects a folder that does not exist', async () => {
  const { store, folder } = await setup()
  await expect(setPersonalNotesFolder(store, join(folder, 'missing'))).rejects.toThrow(
    'Choose an existing folder'
  )
  await expect(setPersonalNotesFolder(store, 'relative/notes')).rejects.toThrow()
})
