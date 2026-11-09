import { PortfolioNoteContent, type PortfolioNote } from './portfolio-notes'

export type ParsedPortfolioNote = { id?: string; note: PortfolioNoteContent }

// JSON-quoted values are valid YAML, so other Markdown tools can read the front matter.
export function portfolioNoteMarkdown(
  note: Pick<PortfolioNote, 'id' | 'title' | 'body' | 'agentContext' | 'updatedAt'>
): string {
  return [
    '---',
    `id: ${JSON.stringify(note.id)}`,
    `title: ${JSON.stringify(note.title)}`,
    `updated: ${JSON.stringify(new Date(note.updatedAt).toISOString())}`,
    `agentContext: ${note.agentContext}`,
    '---',
    note.body
  ].join('\n')
}

export function parsePortfolioNoteMarkdown(text: string, fileName: string): ParsedPortfolioNote {
  const normalized = text.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized)
  const fields = new Map<string, string>()
  for (const line of match?.[1].split('\n') ?? []) {
    const field = /^([A-Za-z]+):\s*(.*)$/.exec(line)
    if (field) {
      fields.set(field[1], unquote(field[2].trim()))
    }
  }
  const body = match ? normalized.slice(match[0].length) : normalized
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]
  const title =
    fields.get('title') || heading?.trim() || fileName.replace(/\.(?:md|markdown|txt)$/i, '')
  const agentContext = fields.get('agentContext')
  return {
    ...(fields.get('id') ? { id: fields.get('id') } : {}),
    note: PortfolioNoteContent.parse({
      title: title.slice(0, 200),
      body,
      agentContext: agentContext === undefined ? true : agentContext === 'true'
    })
  }
}

function unquote(value: string): string {
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === 'string' ? parsed : value
    } catch {
      return value
    }
  }
  return value.replace(/^'(.*)'$/, '$1')
}

export function portfolioNoteFileName(title: string, taken: ReadonlySet<string>): string {
  const base =
    [...title.normalize('NFKC')]
      .map((character) => (character < ' ' ? ' ' : character))
      .join('')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'note'
  let name = `${base}.md`
  for (let index = 2; taken.has(name.toLowerCase()); index += 1) {
    name = `${base}-${index}.md`
  }
  return name
}
