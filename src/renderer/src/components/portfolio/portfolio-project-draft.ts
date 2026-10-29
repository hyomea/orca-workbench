import { z } from 'zod'
import { PortfolioProjectInput } from '../../../../shared/portfolio'
import { PortfolioDiscoveryResult } from '../../../../shared/portfolio-discovery'

const SourceSelection = z.object({
  candidates: z.array(
    z.object({ path: z.string(), name: z.string(), kind: z.enum(['git', 'folder']) })
  ),
  picked: z.array(z.string()),
  added: z.array(z.object({ id: z.string(), name: z.string() }))
})
export type PortfolioSourceSelection = z.infer<typeof SourceSelection>

const ProjectDraft = z.object({
  version: z.literal(1),
  original: PortfolioProjectInput.optional(),
  mode: z.enum(['existing', 'idea', 'manual']),
  name: z.string(),
  objective: z.string(),
  repoIds: z.array(z.string()),
  notes: z.string(),
  feedback: z.string(),
  agent: z.string(),
  language: z.string(),
  result: PortfolioDiscoveryResult.nullable(),
  sources: SourceSelection
})
export type PortfolioProjectDraft = z.infer<typeof ProjectDraft>
const memory = new Map<string, PortfolioProjectDraft | null>()
const storageKey = (key: string): string => `orca:portfolio-project-draft:${key}`

export function readPortfolioProjectDraft(key: string): PortfolioProjectDraft | null {
  if (memory.has(key)) {
    return memory.get(key) ?? null
  }
  try {
    const parsed = ProjectDraft.safeParse(
      JSON.parse(window.sessionStorage.getItem(storageKey(key)) ?? 'null')
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writePortfolioProjectDraft(key: string, draft: PortfolioProjectDraft | null): void {
  if (
    draft &&
    !draft.original &&
    !draft.name &&
    !draft.objective &&
    !draft.notes &&
    !draft.feedback &&
    !draft.result &&
    !draft.repoIds.length &&
    !draft.sources.candidates.length &&
    !draft.sources.added.length
  ) {
    draft = null
  }
  memory.set(key, draft)
  try {
    if (draft) {
      window.sessionStorage.setItem(storageKey(key), JSON.stringify(draft))
    } else {
      window.sessionStorage.removeItem(storageKey(key))
    }
  } catch {
    // Keep panel reopening usable when session storage is unavailable.
  }
}
