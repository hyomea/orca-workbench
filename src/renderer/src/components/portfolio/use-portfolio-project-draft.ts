import { useState } from 'react'
import { i18n } from '@/i18n/i18n'
import { useTaskCreationDraftRetention } from '@/components/use-task-creation-draft-retention'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioDiscoveryResult } from '../../../../shared/portfolio-discovery'
import type { PortfolioSetupActions } from './portfolio-project-setup-types'
import { usePortfolioSourceImport } from './use-portfolio-source-import'
import {
  readPortfolioProjectDraft,
  writePortfolioProjectDraft,
  type PortfolioProjectDraft
} from './portfolio-project-draft'

export function usePortfolioProjectDraft({
  draftKey,
  state,
  projectId,
  editing,
  fromIdea,
  actions
}: {
  draftKey: string
  state: PortfolioState
  projectId: string
  editing: boolean
  fromIdea: boolean
  actions: PortfolioSetupActions
}) {
  const [restored] = useState(() => readPortfolioProjectDraft(draftKey))
  const [original] = useState(
    () =>
      restored?.original ??
      (editing ? state.projects.find((entry) => entry.id === projectId) : undefined)
  )
  const [mode, setMode] = useState<PortfolioProjectDraft['mode']>(
    restored?.mode ?? (editing ? 'manual' : fromIdea ? 'idea' : 'existing')
  )
  const [name, setName] = useState(restored?.name ?? original?.name ?? '')
  const [objective, setObjective] = useState(restored?.objective ?? original?.objective ?? '')
  const [repoIds, setRepoIds] = useState(restored?.repoIds ?? original?.repoIds ?? [])
  const [notes, setNotes] = useState(restored?.notes ?? '')
  const [feedback, setFeedback] = useState(restored?.feedback ?? '')
  const [agent, setAgent] = useState(restored?.agent ?? 'codex')
  const [language, setLanguage] = useState(
    restored?.language ?? (i18n.language.startsWith('zh') ? 'zh' : 'en')
  )
  const [result, setResult] = useState<PortfolioDiscoveryResult | null>(restored?.result ?? null)
  const sourceImport = usePortfolioSourceImport({
    selected: repoIds,
    initial: restored?.sources,
    actions,
    onChange: (ids) => {
      setRepoIds(ids)
      setResult(null)
    }
  })
  const discardDraft = useTaskCreationDraftRetention<PortfolioProjectDraft>({
    open: true,
    draft: {
      version: 1,
      original,
      mode,
      name,
      objective,
      repoIds,
      notes,
      feedback,
      agent,
      language,
      result,
      sources: {
        candidates: sourceImport.candidates,
        picked: sourceImport.picked,
        added: sourceImport.added
      }
    },
    writeDraft: (draft) => writePortfolioProjectDraft(draftKey, draft)
  })
  return {
    original,
    mode,
    setMode,
    name,
    setName,
    objective,
    setObjective,
    repoIds,
    setRepoIds,
    notes,
    setNotes,
    feedback,
    setFeedback,
    agent,
    setAgent,
    language,
    setLanguage,
    result,
    setResult,
    sourceImport,
    discardDraft
  }
}
