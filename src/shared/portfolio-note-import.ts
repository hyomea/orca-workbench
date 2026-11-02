import type { ParsedPortfolioNote } from './portfolio-note-markdown'
import type { PortfolioNote, PortfolioNoteImportEntry } from './portfolio-notes'

export type PortfolioNoteImportRow = {
  file: string
  parsed: ParsedPortfolioNote
  match?: PortfolioNote
  status: 'new' | 'changed' | 'unchanged'
}

// An exported id wins; otherwise a same-titled note is the likely counterpart.
export function planPortfolioNoteImport(
  notes: readonly PortfolioNote[],
  files: readonly { file: string; parsed: ParsedPortfolioNote }[]
): PortfolioNoteImportRow[] {
  const claimed = new Set<string>()
  return files.map(({ file, parsed }) => {
    const title = parsed.note.title.toLocaleLowerCase()
    const match =
      notes.find((note) => note.id === parsed.id && !claimed.has(note.id)) ??
      notes.find((note) => note.title.toLocaleLowerCase() === title && !claimed.has(note.id))
    if (!match) {
      return { file, parsed, status: 'new' }
    }
    claimed.add(match.id)
    const same =
      match.title === parsed.note.title &&
      match.body === parsed.note.body &&
      match.agentContext === parsed.note.agentContext
    return { file, parsed, match, status: same ? 'unchanged' : 'changed' }
  })
}

export function portfolioNoteImportEntries(
  rows: readonly PortfolioNoteImportRow[]
): PortfolioNoteImportEntry[] {
  return rows.flatMap((row): PortfolioNoteImportEntry[] => {
    if (row.status === 'unchanged') {
      return []
    }
    return row.match
      ? [
          {
            kind: 'replace',
            noteId: row.match.id,
            expectedVersion: row.match.version,
            note: row.parsed.note
          }
        ]
      : [{ kind: 'create', note: row.parsed.note }]
  })
}
