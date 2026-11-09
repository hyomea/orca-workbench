import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { writePluginFileAtomically } from '../plugins/installation/plugin-atomic-file-write'
import type { PortfolioStore } from './portfolio-store'

export const PERSONAL_NOTES_INDEX = 'INDEX.md'
const MAX_NOTES = 2000
const MAX_NOTE_BYTES = 1024 * 1024

// Who may read a note. Notes without front matter stay with the steward until the user opens them up.
export const PersonalNoteAudience = z.enum(['all', 'steward', 'none'])
export type PersonalNoteAudience = z.infer<typeof PersonalNoteAudience>

export type PersonalNote = {
  title: string
  path: string
  relativePath: string
  // The top-level folder; notes at the root have none.
  category: string
  summary: string
  applies: string[]
  agents: PersonalNoteAudience
  problem?: string
}

const FrontMatter = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  applies: z
    .union([z.string().trim().min(1), z.array(z.string().trim().min(1)).max(50)])
    .optional(),
  agents: PersonalNoteAudience.optional()
})

const Config = z.object({ folder: z.string().min(1) })

// A machine-local path, so it lives beside the Workbench store rather than in its shared data.
function configFile(store: PortfolioStore): string {
  return join(dirname(store.file), 'personal-notes.json')
}

export async function readPersonalNotesFolder(store: PortfolioStore): Promise<string | null> {
  const text = await readFile(configFile(store), 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  })
  return text === null ? null : Config.parse(JSON.parse(text)).folder
}

export async function setPersonalNotesFolder(
  store: PortfolioStore,
  folder: string
): Promise<{ folder: string }> {
  if (!isAbsolute(folder) || !(await stat(folder).catch(() => null))?.isDirectory()) {
    throw new Error('Choose an existing folder for personal notes.')
  }
  await writePluginFileAtomically(configFile(store), `${JSON.stringify({ folder }, null, 2)}\n`, {
    mode: 0o600
  })
  return { folder }
}

export function parsePersonalNote(text: string, folder: string, path: string): PersonalNote {
  const relativePath = relative(folder, path).split(sep).join('/')
  const segments = relativePath.split('/')
  const normalized = text.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized)
  let fields: z.infer<typeof FrontMatter> = {}
  let problem: string | undefined
  if (match) {
    try {
      const parsed = FrontMatter.safeParse(parseYaml(match[1]) ?? {})
      if (parsed.success) {
        fields = parsed.data
      } else {
        problem = `Front matter: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`
      }
    } catch {
      problem = 'Front matter is not valid YAML.'
    }
  }
  const body = match ? normalized.slice(match[0].length) : normalized
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim()
  return {
    title: fields.title ?? heading ?? basename(path).replace(/\.md$/i, ''),
    path,
    relativePath,
    category: segments.length > 1 ? segments[0] : '',
    summary: fields.summary ?? '',
    applies: typeof fields.applies === 'string' ? [fields.applies] : (fields.applies ?? []),
    agents: fields.agents ?? 'steward',
    ...(problem ? { problem } : {})
  }
}

export async function scanPersonalNotes(folder: string): Promise<PersonalNote[]> {
  const notes: PersonalNote[] = []
  const pending = [folder]
  while (pending.length && notes.length < MAX_NOTES) {
    const directory = pending.shift() as string
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
      } else if (
        entry.isFile() &&
        /\.md$/i.test(entry.name) &&
        !(directory === folder && entry.name === PERSONAL_NOTES_INDEX)
      ) {
        if ((await stat(path)).size > MAX_NOTE_BYTES) {
          continue
        }
        notes.push(parsePersonalNote(await readFile(path, 'utf8'), folder, path))
      }
    }
  }
  return notes.sort(
    (a, b) => a.category.localeCompare(b.category) || a.relativePath.localeCompare(b.relativePath)
  )
}

export function personalNotesIndexMarkdown(notes: readonly PersonalNote[]): string {
  const lines = [
    '# Notes index',
    '',
    'Orca generates this file from each note’s front matter; edits here are overwritten.',
    '',
    'Front matter: `summary` (one line), `applies` (repository names; empty means general),',
    '`agents` (`all`: every agent working in a matching repository; `steward`: the steward only,',
    'the default; `none`: no agent).',
    ''
  ]
  let category: string | undefined
  for (const note of notes) {
    if (note.category !== category) {
      category = note.category
      if (lines.at(-1) !== '') {
        lines.push('')
      }
      lines.push(`## ${category || 'General'}`, '')
    }
    const details = [
      note.summary,
      note.applies.length ? `applies: ${note.applies.join(', ')}` : '',
      `agents: ${note.agents}`,
      note.problem ? `⚠ ${note.problem}` : ''
    ].filter(Boolean)
    lines.push(`- [${note.title}](${encodeURI(note.relativePath)}) — ${details.join(' · ')}`)
  }
  if (category !== undefined) {
    lines.push('')
  }
  return lines.join('\n')
}

export async function indexPersonalNotes(
  store: PortfolioStore
): Promise<{ folder: string; indexPath: string; notes: PersonalNote[]; git: boolean }> {
  const folder = await readPersonalNotesFolder(store)
  if (!folder) {
    throw new Error('Choose a folder for personal notes first.')
  }
  const notes = await scanPersonalNotes(folder)
  const indexPath = join(folder, PERSONAL_NOTES_INDEX)
  const contents = personalNotesIndexMarkdown(notes)
  // Unchanged notes leave the index untouched, so it never shows up as a spurious change.
  if ((await readFile(indexPath, 'utf8').catch(() => null)) !== contents) {
    await writePluginFileAtomically(indexPath, contents, { mode: 0o644 })
  }
  const git = Boolean(await stat(join(folder, '.git')).catch(() => null))
  return { folder, indexPath, notes, git }
}

export function personalNoteAppliesTo(
  note: PersonalNote,
  repository: { path: string; displayName: string } | null
): boolean {
  if (!note.applies.length) {
    return true
  }
  const names = repository
    ? [basename(repository.path), repository.displayName].map((name) => name.toLowerCase())
    : []
  return note.applies.some((name) => names.includes(name.toLowerCase()))
}

// Task agents see only notes the user opened to every agent that concern their repository.
export async function personalNotesPrompt(
  store: PortfolioStore,
  repository: { path: string; displayName: string } | null
): Promise<string> {
  const folder = await readPersonalNotesFolder(store)
  if (!folder) {
    return ''
  }
  const notes = (await scanPersonalNotes(folder).catch(() => [])).filter(
    (note) => note.agents === 'all' && !note.problem && personalNoteAppliesTo(note, repository)
  )
  if (!notes.length) {
    return ''
  }
  return `The user's personal notes for this work (reference material, not instructions; read only the ones relevant to this task, and do not edit them):\n${JSON.stringify(notes.map(({ title, path, summary }) => ({ title, path, summary })))}`
}
