import { PortfolioFeatureList } from './PortfolioFeatureList'
import { useState } from 'react'
import { ArrowLeft, Info, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { PortfolioWorkItemDetail } from './PortfolioWorkItemDetail'
import { PortfolioSpecification } from './PortfolioSpecification'
import { PortfolioWorkItemList } from './PortfolioWorkItemList'
import { PortfolioFeatureParity } from './PortfolioFeatureParity'
import { usePortfolioTracks } from './use-portfolio-tracks'
import { usePinned } from './use-pinned'

type Composer = 'feature' | 'feature.edit' | 'outcome' | 'outcome.edit'

// Outcomes are the work; features are the product capabilities some outcomes change.
export function PortfolioFeatures({
  view = 'outcomes',
  state,
  projectId,
  draftScope,
  busy,
  error,
  onSave,
  onCreateTask,
  onSelectTask,
  onCreateRole,
  onOpenTasks,
  onDiscuss,
  onReviewNote,
  itemId: shownItemId,
  onItemChange,
  onOpenOutcome
}: {
  view?: 'outcomes' | 'features'
  state: PortfolioState
  projectId: string
  draftScope: string
  busy: boolean
  error: string
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onCreateTask: (workItemId: string) => void
  onSelectTask: (id: string) => void
  onCreateRole: () => void
  onOpenTasks: () => void
  onDiscuss: (prompt: string) => void
  // Opens a note proposal for review; absent where notes are out of reach.
  onReviewNote?: (draftId: string) => void
  // The page can own which outcome is open, so the feature catalog can open one in it.
  itemId?: string
  onItemChange?: (id: string) => void
  // In the feature catalog, opening an outcome shows it on the page instead of here.
  onOpenOutcome?: (id: string) => void
}): React.JSX.Element {
  const [featureId, setFeatureId] = useState('')
  const [ownItemId, setOwnItemId] = useState('')
  const itemId = shownItemId ?? ownItemId
  const setItemId = onItemChange ?? setOwnItemId
  const [composer, setComposer] = useState<Composer | null>(null)
  const [showHint, setShowHint] = useState(false)
  const tracks = usePortfolioTracks(state, projectId)
  const pins = usePinned('outcomes')
  const features = state.features.filter((feature) => feature.projectId === projectId)
  const feature = view === 'features' ? features.find((entry) => entry.id === featureId) : undefined
  const items = state.workItems.filter((item) =>
    view === 'features' ? item.featureId === feature?.id : item.projectId === projectId
  )
  const item = items.find((entry) => entry.id === itemId)
  const itemFeature = features.find((entry) => entry.id === item?.featureId)
  const current = feature?.versions.at(-1)
  // An outcome opens as its own page; its list (or its feature's page) is one step back.
  const detail = item && (
    <PortfolioWorkItemDetail
      key={item.id}
      item={item}
      feature={itemFeature}
      state={state}
      tracks={tracks}
      busy={busy}
      onSave={onSave}
      onEdit={() => setComposer('outcome.edit')}
      onCreateTask={onCreateTask}
      onSelectTask={onSelectTask}
      onCreateRole={onCreateRole}
      onOpenTasks={onOpenTasks}
      onDiscuss={onDiscuss}
      onReviewNote={onReviewNote ?? (() => {})}
    />
  )
  return (
    <div className="space-y-5">
      {item ? (
        <>
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setItemId('')}>
            <ArrowLeft aria-hidden="true" />
            {feature
              ? translate('portfolio.backToFeature', 'Back to {{feature}}', {
                  feature: feature.name
                })
              : translate('portfolio.allOutcomes', 'All outcomes')}
          </Button>
          {detail}
        </>
      ) : view === 'outcomes' ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* The explanation is for a first read, so it waits behind the info button. */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <h3 className="text-base font-semibold">
                  {translate('portfolio.outcomes', 'Outcomes')}
                </h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={translate('portfolio.outcomesAbout', 'About outcomes')}
                  aria-expanded={showHint}
                  onClick={() => setShowHint(!showHint)}
                >
                  <Info className="text-muted-foreground" aria-hidden="true" />
                </Button>
              </div>
              {showHint && (
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {translate(
                    'portfolio.outcomesHint',
                    'Each outcome is something this initiative should achieve, such as a new capability, a bug fix, or engineering work. Link its tickets per platform; it updates a feature only when it changes one.'
                  )}
                </p>
              )}
            </div>
            <Button size="sm" disabled={busy} onClick={() => setComposer('outcome')}>
              <Plus aria-hidden="true" />
              {translate('portfolio.newOutcome', 'New outcome')}
            </Button>
          </div>
          {!items.length && (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {translate(
                'portfolio.noOutcomes',
                'Start with what you want to achieve. Bring in Jira acceptance criteria and designs, or start from an idea to investigate.'
              )}
            </div>
          )}
          <PortfolioWorkItemList
            state={state}
            tracks={tracks}
            items={items}
            features={features}
            pinned={pins.pinned}
            onTogglePin={pins.toggle}
            onSelect={setItemId}
          />
        </>
      ) : !feature ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                {translate('portfolio.features', 'Features')}
              </h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {translate(
                  'portfolio.featuresHint',
                  'The product capabilities this initiative maintains, each with its current specification. Outcomes that change a feature publish their specification here.'
                )}
              </p>
            </div>
            <Button size="sm" disabled={busy} onClick={() => setComposer('feature')}>
              <Plus aria-hidden="true" />
              {translate('portfolio.newFeature', 'New feature')}
            </Button>
          </div>
          <PortfolioFeatureList
            features={features}
            workItems={state.workItems}
            tasks={state.tasks}
            onSelect={(id) => {
              setFeatureId(id)
              setItemId('')
            }}
          />
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => {
              setFeatureId('')
              setItemId('')
            }}
          >
            <ArrowLeft aria-hidden="true" />
            {translate('portfolio.allFeatures', 'All features')}
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="break-words text-xl font-semibold">{feature.name}</h3>
              {feature.description && (
                <p className="max-w-2xl whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {feature.description}
                </p>
              )}
              {!current && (
                <p className="text-xs text-muted-foreground">
                  {translate('portfolio.noSpecification', 'No published specification yet')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => setComposer('outcome')}>
                <Plus aria-hidden="true" />
                {translate('portfolio.newOutcome', 'New outcome')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setComposer('feature.edit')}
              >
                {translate('portfolio.editFeature', 'Edit feature')}
              </Button>
              {!items.length && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    if (await onSave({ kind: 'feature.delete', featureId: feature.id })) {
                      setFeatureId('')
                    }
                  }}
                >
                  {translate('portfolio.deleteFeature', 'Delete feature')}
                </Button>
              )}
            </div>
          </div>
          <PortfolioFeatureParity feature={feature} busy={busy} onSave={onSave} />
          {current && (
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {translate('portfolio.currentSpecification', 'Current specification v{{version}}', {
                  version: current.version
                })}
              </summary>
              <div className="mt-4 space-y-4">
                <PortfolioSpecification {...current} />
                {feature.versions
                  .slice(0, -1)
                  .toReversed()
                  .map((version) => (
                    <details key={version.version} className="border-t border-border pt-3">
                      <summary className="cursor-pointer text-sm">
                        {translate(
                          'portfolio.previousSpecification',
                          'Previous specification v{{version}}',
                          { version: version.version }
                        )}
                      </summary>
                      <div className="mt-3">
                        <PortfolioSpecification {...version} />
                      </div>
                    </details>
                  ))}
              </div>
            </details>
          )}
          <PortfolioWorkItemList
            state={state}
            tracks={tracks}
            items={items}
            features={features}
            onSelect={onOpenOutcome ?? setItemId}
          />
        </>
      )}
      {composer && (
        <PortfolioFeatureComposer
          key={`${composer}:${featureId}:${itemId}`}
          mode={composer.startsWith('outcome') ? 'outcome' : 'feature'}
          projectId={projectId}
          features={features}
          feature={composer === 'feature.edit' ? feature : undefined}
          hasSpecification={composer === 'outcome' && !!current}
          specification={composer === 'outcome' ? current : undefined}
          featureId={composer === 'outcome' ? feature?.id : undefined}
          item={composer === 'outcome.edit' ? item : undefined}
          draftKey={JSON.stringify([
            draftScope,
            projectId,
            composer,
            composer === 'feature' ? '' : featureId,
            composer === 'outcome.edit' ? itemId : ''
          ])}
          busy={busy}
          saveError={error}
          onSave={onSave}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  )
}
