import { usePortfolioProjectDraft } from './use-portfolio-project-draft'
import { PortfolioProjectSetupFooter } from './PortfolioProjectSetupFooter'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { translate } from '@/i18n/i18n'
import { PortfolioCommand, type PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioDiscover } from '../../../../shared/portfolio-discovery'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { PortfolioSourcePicker } from './PortfolioSourcePicker'
import { PortfolioObjectiveFields } from './PortfolioObjectiveFields'
import { PortfolioDiscoveryReview } from './PortfolioDiscoveryReview'
import type { PortfolioSetupActions } from './portfolio-project-setup-types'

export function PortfolioProjectSetup({
  state,
  draftKey,
  projectId,
  editing,
  fromIdea,
  repos,
  actions,
  busy,
  saveError,
  onSave,
  onClose
}: {
  state: PortfolioState
  draftKey: string
  projectId: string
  editing: boolean
  fromIdea: boolean
  repos: readonly { id: string; name: string }[]
  actions: PortfolioSetupActions
  busy: boolean
  saveError: string
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const {
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
  } = usePortfolioProjectDraft({ draftKey, state, projectId, editing, fromIdea, actions })
  const [analyzing, setAnalyzing] = useState(false)
  const sourceBusy = sourceImport.phase !== 'idle'
  const [error, setError] = useState('')
  const [closeBlocked, setCloseBlocked] = useState(false)
  const activeRequest = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (activeRequest.current) {
        void actions.cancelDiscovery(activeRequest.current).catch(() => {})
      }
      activeRequest.current = null
    },
    [actions]
  )

  function close(): void {
    if (busy || sourceBusy || analyzing) {
      setCloseBlocked(true)
      return
    }
    onClose()
  }

  function stop(): void {
    const id = activeRequest.current
    activeRequest.current = null
    setAnalyzing(false)
    if (id) {
      void actions.cancelDiscovery(id).catch((failure) => setError(String(failure)))
    }
  }
  async function analyze(refine = false): Promise<void> {
    if (activeRequest.current || busy || sourceBusy) {
      return
    }
    const requestId = createBrowserUuid()
    const combinedNotes = refine ? `${notes}\n\n${feedback}`.trim() : notes
    if (combinedNotes.length > 10000) {
      setError(
        translate(
          'portfolio.notesTooLong',
          'Shorten the project notes before generating another draft.'
        )
      )
      return
    }
    activeRequest.current = requestId
    setAnalyzing(true)
    setCloseBlocked(false)
    setError('')
    try {
      const sources = sourceImport.pendingCount > 0 ? await sourceImport.importSelected() : repoIds
      if (!sources || activeRequest.current !== requestId) {
        return
      }
      const request: PortfolioDiscover = {
        requestId,
        repoIds: sources,
        agent: agent === 'claude' ? 'claude' : 'codex',
        language: language === 'zh' ? 'zh' : 'en',
        notes: combinedNotes,
        ...(refine && result ? { previous: { ...result.draft, name, objective } } : {})
      }
      const next = await actions.discover(request)
      if (activeRequest.current !== requestId) {
        return
      }
      setResult(next)
      setName(next.draft.name)
      setObjective(next.draft.objective)
      setNotes(combinedNotes)
      setFeedback('')
    } catch (failure) {
      if (activeRequest.current === requestId) {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (activeRequest.current === requestId) {
        activeRequest.current = null
        setAnalyzing(false)
      }
    }
  }
  async function save(): Promise<void> {
    if (analyzing || busy || sourceBusy || sourceImport.pendingCount > 0) {
      return
    }
    const command = PortfolioCommand.safeParse(
      editing
        ? {
            kind: 'project.update',
            projectId,
            project: { name, objective, repoIds },
            expected: original && {
              name: original.name,
              objective: original.objective,
              repoIds: original.repoIds
            }
          }
        : { kind: 'project.create', project: { name, objective, repoIds } }
    )
    if (!command.success) {
      setError(
        translate(
          'portfolio.projectFieldsRequired',
          'Provide a project name and objective before confirming.'
        )
      )
      return
    }
    if (await onSave(command.data)) {
      discardDraft()
      onClose()
    }
  }
  const disabled = busy || analyzing || sourceBusy
  const message =
    error ||
    saveError ||
    (closeBlocked && disabled
      ? translate(
          'portfolio.analysisCloseGuard',
          'Work is still running. Wait for it to finish, or use Stop before closing.'
        )
      : '')
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          <SheetHeader>
            <SheetTitle>
              {editing
                ? translate('portfolio.editProject', 'Edit project')
                : translate('portfolio.newProject', 'New project')}
            </SheetTitle>
            <SheetDescription>
              {translate(
                'portfolio.setupDescription',
                'Start with your directory or an idea. Closing keeps your draft in this window until you confirm or discard it.'
              )}
            </SheetDescription>
          </SheetHeader>
          <form
            className="space-y-5 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: 'existing' as const,
                  label: translate('portfolio.existingProject', 'Existing project')
                },
                {
                  id: 'idea' as const,
                  label: translate('portfolio.fromIdea', 'Start with an idea')
                },
                {
                  id: 'manual' as const,
                  label: translate('portfolio.writeManually', 'Write manually')
                }
              ].map((entry) => (
                <Button
                  key={entry.id}
                  type="button"
                  size="sm"
                  variant={mode === entry.id ? 'secondary' : 'ghost'}
                  aria-pressed={mode === entry.id}
                  disabled={disabled}
                  onClick={() => setMode(entry.id)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
            {(mode !== 'idea' || repoIds.length > 0 || sourceImport.candidates.length > 0) && (
              <PortfolioSourcePicker
                repos={repos}
                selected={repoIds}
                onChange={(ids) => {
                  stop()
                  setRepoIds(ids)
                  setResult(null)
                }}
                sourceImport={sourceImport}
                disabled={busy || analyzing}
                manual={mode === 'manual'}
              />
            )}
            {mode !== 'manual' && (
              <section className="space-y-4">
                <PortfolioField
                  label={translate('portfolio.projectNotes', 'Tell us what you have in mind')}
                >
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    maxLength={10000}
                    disabled={disabled}
                    placeholder={translate(
                      'portfolio.notesPlaceholder',
                      'Use your own words, in Chinese or English. What would you like this project to become?'
                    )}
                  />
                </PortfolioField>
                <div className="grid grid-cols-2 gap-3">
                  <PortfolioSelect
                    label={translate('portfolio.agent', 'Agent')}
                    value={agent}
                    onChange={setAgent}
                    disabled={disabled}
                    options={[
                      { id: 'codex', name: 'Codex' },
                      { id: 'claude', name: 'Claude' }
                    ]}
                  />
                  <PortfolioSelect
                    label={translate('portfolio.responseLanguage', 'Response language')}
                    value={language}
                    onChange={setLanguage}
                    disabled={disabled}
                    options={[
                      { id: 'zh', name: '中文' },
                      { id: 'en', name: 'English' }
                    ]}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.analysisProviderHint',
                    'Uses the selected agent’s configured account. Selected project excerpts are sent for analysis; no project files are edited.'
                  )}
                </p>
                {!analyzing && (
                  <Button
                    type="button"
                    variant={result ? 'outline' : 'default'}
                    disabled={
                      busy ||
                      sourceBusy ||
                      (!sourceImport.pendingCount &&
                        !repoIds.length &&
                        (mode === 'existing' || !notes.trim()))
                    }
                    onClick={() => void analyze()}
                  >
                    {sourceImport.pendingCount > 0
                      ? translate('portfolio.importAndAnalyze', 'Import and analyze')
                      : result
                        ? translate('portfolio.scanAgain', 'Generate again')
                        : translate('portfolio.draftObjective', 'Draft objective with AI')}
                  </Button>
                )}
                {analyzing && (
                  <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
                    <LoadingSpinner className="size-4" />
                    <span>
                      {sourceImport.phase === 'importing'
                        ? translate(
                            'portfolio.importingDirectories',
                            'Importing selected directories…'
                          )
                        : translate(
                            'portfolio.analyzingProject',
                            'Reading project context and drafting an objective…'
                          )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={sourceBusy}
                      onClick={stop}
                    >
                      {translate('portfolio.stopAnalysis', 'Stop')}
                    </Button>
                  </div>
                )}
              </section>
            )}
            {result && mode !== 'manual' && (
              <PortfolioDiscoveryReview
                result={result}
                feedback={feedback}
                onFeedback={setFeedback}
                onRefine={() => void analyze(true)}
                disabled={disabled}
              />
            )}
            {(mode === 'manual' || result || editing) && (
              <PortfolioObjectiveFields
                name={name}
                objective={objective}
                setName={setName}
                setObjective={setObjective}
                disabled={disabled}
              />
            )}
            {message && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <PortfolioProjectSetupFooter
              disabled={disabled}
              canSave={!sourceImport.pendingCount && !!name.trim() && !!objective.trim()}
              saving={busy}
              showSave={mode === 'manual' || !!result || editing}
              onClose={close}
              onDiscard={() => {
                discardDraft()
                onClose()
              }}
            />
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
