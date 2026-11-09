import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentLaunchResult } from '../../shared/agent-launch/contracts/agent-launch-intent'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from '../../shared/portfolio'
import {
  parsePortfolioNoteMarkdown,
  portfolioNoteMarkdown
} from '../../shared/portfolio-note-markdown'
import {
  planPortfolioNoteImport,
  portfolioNoteImportEntries
} from '../../shared/portfolio-note-import'
import { launchPortfolioTask } from './portfolio-execution'
import { exportPortfolioNotes } from './portfolio-note-files'
import { PortfolioStore } from './portfolio-store'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'orca-notes-'))
  directories.push(directory)
  return directory
}

function apply(state: PortfolioState, command: unknown, id = 'id', now = 10): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, now)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    {
      kind: 'project.create',
      project: { name: 'Ludus', objective: 'Parity', repoIds: ['android'] }
    },
    'p'
  )
  apply(
    state,
    { kind: 'project.create', project: { name: 'Other', objective: 'x', repoIds: [] } },
    'q'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Dev', responsibility: 'Build', agent: 'codex' } },
    'r'
  )
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'p',
        roleId: 'r',
        title: 'Tests',
        instructions: 'Add',
        acceptanceCriteria: 'Pass'
      }
    },
    't'
  )
  return state
}

const content = (title: string, body = 'Body', agentContext = true) => ({
  title,
  body,
  agentContext
})

function receipt(): AgentLaunchResult {
  return {
    outcome: { kind: 'terminal', handle: 'terminal', paneKey: 'tab:leaf' },
    worktreeId: 'workspace',
    prompt: { delivery: 'submit', outcome: 'handed-to-terminal' },
    receipt: { mode: 'terminal', preferred: 'terminal', reason: 'user_default', detail: 'Terminal' }
  }
}

describe('project notes', () => {
  it('versions edits and rejects a stale editor', () => {
    const state = fixture()
    apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing') }, 'n', 20)
    apply(
      state,
      { kind: 'note.update', noteId: 'n', expectedVersion: 1, note: content('Testing', 'v2') },
      'x',
      30
    )
    expect(state.notes[0]).toMatchObject({ version: 2, body: 'v2', createdAt: 20, updatedAt: 30 })
    expect(() =>
      apply(state, { kind: 'note.update', noteId: 'n', expectedVersion: 1, note: content('Stale') })
    ).toThrow('changed elsewhere')
    expect(() =>
      apply(state, { kind: 'note.create', projectId: 'missing', note: content('A') })
    ).toThrow('Initiative no longer exists')
  })

  it('keeps agent proposals reviewable and never applies them without acceptance', () => {
    const state = fixture()
    apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing', 'old') }, 'n')
    apply(
      state,
      {
        kind: 'noteDraft.submit',
        draft: {
          projectId: 'p',
          noteId: 'n',
          taskId: 't',
          title: 'Testing',
          body: 'new',
          reason: 'Verified'
        }
      },
      'd'
    )
    expect(state.notes[0].body).toBe('old')
    expect(state.noteDrafts[0]).toMatchObject({ baseVersion: 1, taskId: 't' })
    expect(() =>
      apply(state, {
        kind: 'noteDraft.submit',
        draft: { projectId: 'q', noteId: 'n', title: 'Wrong project', body: '', reason: '' }
      })
    ).toThrow('does not exist in this initiative')
    expect(() =>
      apply(state, {
        kind: 'noteDraft.submit',
        draft: { projectId: 'q', taskId: 't', title: 'Wrong task', body: '', reason: '' }
      })
    ).toThrow('task does not belong')
    expect(() =>
      apply(state, { kind: 'noteDraft.accept', draftId: 'd', note: content('Testing', 'new') })
    ).toThrow('Review the current note')
    apply(state, {
      kind: 'noteDraft.accept',
      draftId: 'd',
      expectedVersion: 1,
      note: content('Testing', 'edited by reviewer', false)
    })
    expect(state.notes[0]).toMatchObject({
      version: 2,
      body: 'edited by reviewer',
      agentContext: false
    })
    expect(state.noteDrafts).toEqual([])
  })

  it('turns proposals for a deleted note into new-note proposals', () => {
    const state = fixture()
    apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing') }, 'n')
    apply(
      state,
      {
        kind: 'noteDraft.submit',
        draft: { projectId: 'p', noteId: 'n', title: 'Testing', body: 'new', reason: '' }
      },
      'd'
    )
    apply(state, { kind: 'note.delete', noteId: 'n', expectedVersion: 1 })
    expect(state.notes).toEqual([])
    expect(state.noteDrafts[0].noteId).toBeUndefined()
    apply(
      state,
      { kind: 'noteDraft.accept', draftId: 'd', note: content('Testing', 'new') },
      'created'
    )
    expect(state.notes[0]).toMatchObject({ id: 'created', projectId: 'p', body: 'new' })
  })

  it('round-trips Markdown and accepts plain Markdown files', () => {
    const note = {
      id: 'n',
      title: 'Android: "testing" ✓',
      body: '---\nnot front matter\n',
      agentContext: false,
      updatedAt: 0
    }
    expect(parsePortfolioNoteMarkdown(portfolioNoteMarkdown(note), 'x.md')).toEqual({
      id: 'n',
      note: { title: note.title, body: note.body, agentContext: false }
    })
    expect(parsePortfolioNoteMarkdown('﻿# Local setup\r\nSteps', 'setup.md')).toEqual({
      note: { title: 'Local setup', body: '# Local setup\nSteps', agentContext: true }
    })
    expect(parsePortfolioNoteMarkdown('Steps', 'adb-guide.md').note.title).toBe('adb-guide')
  })

  it('matches imports by id, then title, and replaces only reviewed versions', () => {
    const state = fixture()
    apply(state, { kind: 'note.create', projectId: 'p', note: content('Setup', 'same') }, 'a')
    apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing', 'old') }, 'b')
    const rows = planPortfolioNoteImport(state.notes, [
      { file: '1.md', parsed: { note: content('setup', 'same') } },
      { file: '2.md', parsed: { id: 'b', note: content('Renamed', 'new') } },
      { file: '3.md', parsed: { note: content('Fresh') } }
    ])
    expect(rows.map((row) => [row.status, row.match?.id])).toEqual([
      ['changed', 'a'],
      ['changed', 'b'],
      ['new', undefined]
    ])
    const entries = portfolioNoteImportEntries(rows.slice(1))
    apply(state, { kind: 'note.import', projectId: 'p', entries }, 'imp')
    expect(state.notes.map((note) => [note.id, note.title, note.version])).toEqual([
      ['a', 'Setup', 1],
      ['b', 'Renamed', 2],
      ['imp:1', 'Fresh', 1]
    ])
    expect(() => apply(state, { kind: 'note.import', projectId: 'p', entries })).toThrow(
      'changed elsewhere'
    )
  })

  it('migrates v4 data with a backup', async () => {
    const directory = await temporary()
    const file = join(directory, 'portfolio.json')
    const { notes: _notes, noteDrafts: _drafts, ...v4 } = fixture()
    const original = JSON.stringify({ ...v4, schemaVersion: 4 })
    await writeFile(file, original)
    const store = new PortfolioStore(file)
    expect((await store.read()).notes).toEqual([])
    await store.update(v4.revision, (state) =>
      apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing') })
    )
    expect(await readFile(`${file}.v4.bak`, 'utf8')).toBe(original)
    expect(JSON.parse(await readFile(file, 'utf8')).schemaVersion).toBe(6)
  })

  it('lists agent notes as immutable files and keeps the prompt on retry', async () => {
    const directory = await temporary()
    const store = new PortfolioStore(join(directory, 'portfolio.json'))
    await store.update(0, (state) => {
      Object.assign(state, fixture())
      apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing', 'gradle') }, 'n')
      apply(
        state,
        { kind: 'note.create', projectId: 'p', note: content('Private', 'x', false) },
        'h'
      )
      apply(state, { kind: 'note.create', projectId: 'q', note: content('Elsewhere') }, 'o')
    })
    const launched = await launchPortfolioTask(
      store,
      { revision: 1, taskId: 't', worktreeId: 'workspace', repoId: 'android' },
      async () => {
        throw new Error('disconnected')
      }
    )
    const prompt = launched.tasks[0].attempts[0].prompt
    const listed = JSON.parse(/Initiative notes[^\n]*\n(.*)\n/.exec(prompt)?.[1] ?? '[]')
    expect(listed.map((entry: { title: string }) => entry.title)).toEqual(['Testing'])
    expect(await readFile(listed[0].path, 'utf8')).toContain('gradle')
    expect(prompt).toContain('orca workbench note propose --project "p" --task "t"')
    await store.update(null, (state) =>
      apply(state, {
        kind: 'note.update',
        noteId: 'n',
        expectedVersion: 1,
        note: content('Testing', 'changed')
      })
    )
    const retried = await launchPortfolioTask(
      store,
      {
        revision: (await store.read()).revision,
        taskId: 't',
        worktreeId: 'workspace',
        repoId: 'android'
      },
      async () => receipt()
    )
    expect(retried.tasks[0].attempts).toHaveLength(1)
    expect(retried.tasks[0].attempts[0].prompt).toBe(prompt)
    expect(await readFile(listed[0].path, 'utf8')).toContain('gradle')
  })

  it('exports to Markdown, updates its own files, and never replaces unrelated files', async () => {
    const directory = await temporary()
    const target = join(directory, 'export')
    await mkdir(target)
    await writeFile(join(target, 'Testing.md'), 'my own file')
    const store = new PortfolioStore(join(directory, 'portfolio.json'))
    await store.update(0, (state) => {
      Object.assign(state, fixture())
      apply(state, { kind: 'note.create', projectId: 'p', note: content('Testing', 'v1') }, 'n')
    })
    expect(await exportPortfolioNotes(store, 'p', target)).toEqual({ written: 1 })
    expect(await readFile(join(target, 'Testing.md'), 'utf8')).toBe('my own file')
    expect(await readFile(join(target, 'Testing-2.md'), 'utf8')).toContain('v1')
    await store.update(null, (state) =>
      apply(state, {
        kind: 'note.update',
        noteId: 'n',
        expectedVersion: 1,
        note: content('Renamed', 'v2')
      })
    )
    await exportPortfolioNotes(store, 'p', target)
    expect((await readdir(target)).sort()).toEqual(['Testing-2.md', 'Testing.md'])
    const exported = parsePortfolioNoteMarkdown(
      await readFile(join(target, 'Testing-2.md'), 'utf8'),
      'x'
    )
    expect(exported).toEqual({ id: 'n', note: content('Renamed', 'v2') })
    await expect(exportPortfolioNotes(store, 'q', target)).rejects.toThrow('no notes')
  })
})
