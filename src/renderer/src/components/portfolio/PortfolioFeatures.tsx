import { PortfolioFeatureList } from './PortfolioFeatureList'
import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { PortfolioWorkItemDetail } from './PortfolioWorkItemDetail'
import { PortfolioSpecification } from './PortfolioSpecification'
import { PortfolioWorkItemList } from './PortfolioWorkItemList'

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
      <div className="space-y-3">
        {feature && (
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
        )}
        <div className="flex flex-col items-start justify-between gap-3 @2xl/project:flex-row">
          {feature ? (
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
          ) : (
            <h3 className="text-base font-semibold">
              {translate('portfolio.features', 'Features')}
            </h3>
          )}
          {(!feature || items.length > 0 || current) && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setComposer(feature ? 'item' : 'feature')}
            >
              <Plus aria-hidden="true" />
              {feature
                ? translate('portfolio.newWorkItem', 'New work item')
                : translate('portfolio.newFeature', 'New feature')}
            </Button>
          )}
        </div>
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
          <PortfolioFeatureList
            features={features}
            workItems={state.workItems}
            onSelect={(id) => {
              setFeatureId(id)
              setItemId('')
            }}
          />
        </>
      ) : (
        <>
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
          <PortfolioWorkItemList items={items} selectedId={item?.id} onSelect={setItemId} />
          {!items.length && (
            <section className="space-y-4 rounded-xl border border-dashed border-border p-6">
              <div className="max-w-lg space-y-2">
                <h4 className="text-base font-semibold">
                  {translate('portfolio.firstWorkItem', 'Start with the first work item')}
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {translate(
                    'portfolio.firstWorkItemHint',
                    'Bring in Jira acceptance criteria and designs, or start with an idea to investigate. Tasks and platform checks will stay together here.'
                  )}
                </p>
              </div>
              <Button
                disabled={busy}
                variant={current ? 'outline' : 'default'}
                onClick={() => setComposer('item')}
              >
                <Plus aria-hidden="true" />
                {translate('portfolio.newWorkItem', 'New work item')}
              </Button>
            </section>
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
          specification={composer === 'item' ? current : undefined}
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
