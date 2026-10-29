import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { PortfolioWorkItemDetail } from './PortfolioWorkItemDetail'
import { PortfolioSpecification } from './PortfolioSpecification'
import { workItemKinds, workItemStatuses } from './portfolio-feature-labels'

export function PortfolioFeatures({
  state,
  projectId,
  draftScope,
  busy,
  error,
  onSave,
  onCreateTask,
  onSelectTask,
  onCreateRole
}: {
  state: PortfolioState
  projectId: string
  draftScope: string
  busy: boolean
  error: string
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onCreateTask: (workItemId: string) => void
  onSelectTask: (id: string) => void
  onCreateRole: () => void
}): React.JSX.Element {
  const [featureId, setFeatureId] = useState('')
  const [itemId, setItemId] = useState('')
  const [composer, setComposer] = useState<'feature' | 'item' | 'edit' | null>(null)
  const features = state.features.filter((feature) => feature.projectId === projectId)
  const feature = features.find((entry) => entry.id === featureId)
  const items = state.workItems.filter((item) => item.featureId === feature?.id)
  const item = items.find((entry) => entry.id === itemId)
  const current = feature?.versions.at(-1)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {feature ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFeatureId('')
              setItemId('')
            }}
          >
            <ArrowLeft aria-hidden="true" />
            {translate('portfolio.allFeatures', 'All features')}
          </Button>
        ) : (
          <h3 className="text-base font-semibold">{translate('portfolio.features', 'Features')}</h3>
        )}
        <Button size="sm" disabled={busy} onClick={() => setComposer(feature ? 'item' : 'feature')}>
          <Plus aria-hidden="true" />
          {feature
            ? translate('portfolio.newWorkItem', 'New work item')
            : translate('portfolio.newFeature', 'New feature')}
        </Button>
      </div>
      {!feature ? (
        <>
          <p className="text-sm text-muted-foreground">
            {translate(
              'portfolio.featuresHint',
              'Keep each feature’s shared context together. Track initial delivery, bugs, and improvements as separate work items.'
            )}
          </p>
          {!features.length && (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {translate(
                'portfolio.noFeatures',
                'Create a feature with a user outcome, then add the first piece of work. You can start from an idea or existing requirements.'
              )}
            </div>
          )}
          <div className="grid gap-3 @xl/project:grid-cols-2">
            {features.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => {
                  setFeatureId(entry.id)
                  setItemId('')
                }}
                className="space-y-2 rounded-xl border border-border bg-card p-4 text-left text-card-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block break-words text-sm font-semibold">{entry.name}</span>
                <span className="block line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {entry.description}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {translate(
                    'portfolio.featureCounts',
                    '{{count}} work items · specification v{{version}}',
                    {
                      count: state.workItems.filter((item) => item.featureId === entry.id).length,
                      version: entry.versions.at(-1)?.version ?? 0
                    }
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="break-words text-xl font-semibold">{feature.name}</h3>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {current
                ? translate(
                    'portfolio.currentSpecification',
                    'Current specification v{{version}}',
                    { version: current.version }
                  )
                : translate('portfolio.noSpecification', 'No published specification yet')}
            </summary>
            <div className="mt-4 space-y-4">
              {current ? (
                <PortfolioSpecification {...current} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {translate(
                    'portfolio.specificationHint',
                    'Draft requirements in an initial delivery work item. Review and accept the work, then explicitly publish its specification.'
                  )}
                </p>
              )}
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
          <div className="flex flex-wrap gap-2">
            {items.map((entry) => (
              <Button
                key={entry.id}
                variant={entry.id === itemId ? 'secondary' : 'outline'}
                className="h-auto max-w-full flex-wrap justify-start py-2 text-left"
                onClick={() => setItemId(entry.id)}
              >
                <span className="whitespace-normal break-words">{entry.title}</span>
                <Badge variant="outline">
                  {workItemKinds().find((kind) => kind.id === entry.kind)?.name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {workItemStatuses().find((status) => status.id === entry.status)?.name}
                </span>
              </Button>
            ))}
          </div>
          {!items.length && (
            <p className="text-sm text-muted-foreground">
              {translate(
                'portfolio.noWorkItems',
                'Add an initial delivery, bug, improvement, or issue that needs triage.'
              )}
            </p>
          )}
          {items.length > 0 && !item && (
            <p className="text-sm text-muted-foreground">
              {translate(
                'portfolio.selectWorkItem',
                'Select a work item to review its context, tasks, and history.'
              )}
            </p>
          )}
          {item && (
            <PortfolioWorkItemDetail
              key={item.id}
              item={item}
              feature={feature}
              state={state}
              busy={busy}
              onSave={onSave}
              onEdit={() => setComposer('edit')}
              onCreateTask={onCreateTask}
              onSelectTask={onSelectTask}
              onCreateRole={onCreateRole}
            />
          )}
        </>
      )}
      {composer && (
        <PortfolioFeatureComposer
          key={`${composer}:${featureId}:${itemId}`}
          projectId={projectId}
          hasSpecification={!!current}
          featureId={composer === 'feature' ? undefined : feature?.id}
          item={composer === 'edit' ? item : undefined}
          draftKey={JSON.stringify([
            draftScope,
            projectId,
            composer,
            composer === 'feature' ? '' : featureId,
            composer === 'edit' ? itemId : ''
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
