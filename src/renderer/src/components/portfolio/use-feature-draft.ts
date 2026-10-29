import { useState } from 'react'
import { z } from 'zod'
import { useTaskCreationDraftRetention } from '@/components/use-task-creation-draft-retention'
import {
  PortfolioWorkItemInput,
  type PortfolioWorkItem
} from '../../../../shared/portfolio-features'

const Draft = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.string(),
  acceptanceCriteria: z.string(),
  designReferences: z.string(),
  sourceReference: z.string(),
  expected: PortfolioWorkItemInput.optional()
})
type Draft = z.infer<typeof Draft>
const memory = new Map<string, Draft | null>()
const keyFor = (key: string): string => `orca:feature-draft:${key}`
function read(key: string): Draft | null {
  if (memory.has(key)) {
    return memory.get(key) ?? null
  }
  try {
    const parsed = Draft.safeParse(JSON.parse(sessionStorage.getItem(keyFor(key)) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
function write(key: string, value: Draft | null): void {
  memory.set(key, value)
  try {
    if (value) {
      sessionStorage.setItem(keyFor(key), JSON.stringify(value))
    } else {
      sessionStorage.removeItem(keyFor(key))
    }
  } catch {
    /* Retain the in-memory draft when storage is unavailable. */
  }
}
export function useFeatureDraft(key: string, item?: PortfolioWorkItem, initialKind = 'initial') {
  const [draft, setDraft] = useState<Draft>(
    () =>
      read(key) ?? {
        name: '',
        title: item?.title ?? '',
        description: item?.description ?? '',
        kind: item?.kind ?? initialKind,
        acceptanceCriteria: item?.acceptanceCriteria ?? '',
        designReferences: item?.designReferences ?? '',
        sourceReference: item?.sourceReference ?? '',
        expected: item && PortfolioWorkItemInput.parse(item)
      }
  )
  const discard = useTaskCreationDraftRetention({
    open: true,
    draft,
    writeDraft: (value) => write(key, value)
  })
  function field(name: keyof Omit<Draft, 'expected'>, value: string): void {
    setDraft((current) => ({ ...current, [name]: value }))
  }
  return { draft, field, discard }
}
