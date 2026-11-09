import { useEffect, useRef, useState } from 'react'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import { PortfolioIntake, type PortfolioIntakeSource } from '../../../../shared/portfolio-intake'
import { readPortfolioIntake, cancelPortfolioIntake } from './portfolio-intake-actions'
import type { useFeatureDraft } from './use-feature-draft'

export function usePortfolioIntake(editor: ReturnType<typeof useFeatureDraft>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<string | null>(null)
  useEffect(
    () => () => {
      const requestId = active.current
      active.current = null
      if (requestId) {
        void cancelPortfolioIntake(requestId).catch(() => {})
      }
    },
    []
  )
  async function analyze(source?: PortfolioIntakeSource): Promise<void> {
    if (active.current) {
      return
    }
    const sources = [
      ...(editor.draft.intakeSources ?? []).filter((entry) => entry.url !== source?.url),
      ...(source ? [source] : [])
    ]
    setError('')
    const requestId = createBrowserUuid()
    const fields = { ...editor.draft }
    if (source && !source.content && !fields.designReferences.includes(source.url)) {
      fields.designReferences = [fields.designReferences.trim(), `${source.title}: ${source.url}`]
        .filter(Boolean)
        .join('\n\n')
    }
    try {
      const request = PortfolioIntake.parse({
        requestId,
        agent: editor.draft.intakeAgent ?? 'codex',
        language: editor.draft.intakeLanguage ?? 'en',
        kind: editor.draft.kind,
        fields,
        sources,
        notes: editor.draft.intakeNotes ?? ''
      })
      editor.rememberSources(sources)
      active.current = requestId
      setPending(true)
      const result = await readPortfolioIntake(request)
      if (active.current === requestId) {
        editor.applyIntake(result)
      }
    } catch (failure) {
      if (!active.current || active.current === requestId) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (active.current === requestId) {
        active.current = null
      }
      setPending(false)
    }
  }
  async function stop(): Promise<void> {
    const requestId = active.current
    if (!requestId) {
      return
    }
    try {
      await cancelPortfolioIntake(requestId)
      if (active.current === requestId) {
        active.current = null
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }
  return { pending, error, analyze, stop }
}
