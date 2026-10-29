import { useState } from 'react'
import type { z } from 'zod'
import { useTaskCreationDraftRetention } from '@/components/use-task-creation-draft-retention'

const memory = new Map<string, unknown>()
export function usePortfolioVerificationDraft<T>(key: string, schema: z.ZodType<T>, initial: T) {
  const storageKey = `orca:verification-draft:${key}`
  const [draft, setDraft] = useState<T>(() => {
    try {
      const value = schema.safeParse(
        memory.get(storageKey) ?? JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
      )
      return value.success ? value.data : initial
    } catch {
      return initial
    }
  })
  const discard = useTaskCreationDraftRetention({
    open: true,
    draft,
    writeDraft: (value) => {
      memory.set(storageKey, value)
      try {
        if (value) {
          sessionStorage.setItem(storageKey, JSON.stringify(value))
        } else {
          sessionStorage.removeItem(storageKey)
        }
      } catch {
        /* Keep the in-memory draft if storage is unavailable. */
      }
    }
  })
  return { draft, setDraft, discard }
}
