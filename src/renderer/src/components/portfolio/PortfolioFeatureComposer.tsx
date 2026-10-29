import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { PortfolioCommand } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { PortfolioProjectSetupFooter } from './PortfolioProjectSetupFooter'
import { workItemKinds } from './portfolio-feature-labels'
import { useFeatureDraft } from './use-feature-draft'

export function PortfolioFeatureComposer({
  projectId,
  featureId,
  item,
  draftKey,
  hasSpecification,
  busy,
  saveError,
  onSave,
  onClose
}: {
  projectId: string
  featureId?: string
  item?: PortfolioWorkItem
  draftKey: string
  hasSpecification?: boolean
  busy: boolean
  saveError: string
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const { draft, field, discard } = useFeatureDraft(
    draftKey,
    item,
    hasSpecification ? 'improvement' : 'initial'
  )
  const [error, setError] = useState('')
  const isItem = !!featureId
  async function save(): Promise<void> {
    if (busy) {
      return
    }
    const workItem = {
      featureId,
      kind: draft.kind,
      title: draft.title,
      description: draft.description,
      acceptanceCriteria: draft.acceptanceCriteria,
      designReferences: draft.designReferences,
      sourceReference: draft.sourceReference
    }
    const parsed = PortfolioCommand.safeParse(
      isItem
        ? item
          ? { kind: 'workItem.update', workItemId: item.id, workItem, expected: draft.expected }
          : { kind: 'workItem.create', workItem }
        : {
            kind: 'feature.create',
            feature: { projectId, name: draft.name, description: draft.description }
          }
    )
    if (!parsed.success) {
      setError(translate('portfolio.featureRequired', 'Enter a name and check the field lengths.'))
      return
    }
    if (await onSave(parsed.data)) {
      discard()
      onClose()
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose()
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          <SheetHeader>
            <SheetTitle>
              {isItem
                ? item
                  ? translate('portfolio.editWorkItem', 'Edit work item')
                  : translate('portfolio.newWorkItem', 'New work item')
                : translate('portfolio.newFeature', 'New feature')}
            </SheetTitle>
            <SheetDescription>
              {translate(
                'portfolio.featureDraftHint',
                'Start with an idea or paste existing requirements. Closing keeps this draft in the current window.'
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
            <fieldset disabled={busy} className="space-y-5">
              {isItem && (
                <PortfolioSelect
                  label={translate('portfolio.workItemType', 'Work type')}
                  value={draft.kind}
                  onChange={(value) => field('kind', value)}
                  options={workItemKinds().filter(
                    (kind) => !hasSpecification || kind.id !== 'initial'
                  )}
                  disabled={busy}
                />
              )}
              <PortfolioField label={translate('portfolio.name', 'Name')}>
                <Input
                  value={isItem ? draft.title : draft.name}
                  onChange={(event) => field(isItem ? 'title' : 'name', event.target.value)}
                  required
                  maxLength={200}
                />
              </PortfolioField>
              <PortfolioField
                label={
                  isItem
                    ? translate('portfolio.changeDescription', 'Problem or proposed change')
                    : translate('portfolio.featurePurpose', 'User outcome and shared context')
                }
              >
                <Textarea
                  value={draft.description}
                  onChange={(event) => field('description', event.target.value)}
                  rows={4}
                  maxLength={12000}
                />
              </PortfolioField>
              {isItem && (
                <>
                  <PortfolioField
                    label={translate('portfolio.acceptanceCriteria', 'Acceptance criteria')}
                  >
                    <Textarea
                      value={draft.acceptanceCriteria}
                      onChange={(event) => field('acceptanceCriteria', event.target.value)}
                      rows={5}
                      maxLength={12000}
                    />
                  </PortfolioField>
                  <PortfolioField
                    label={translate('portfolio.designReferences', 'Design references and notes')}
                  >
                    <Textarea
                      value={draft.designReferences}
                      onChange={(event) => field('designReferences', event.target.value)}
                      rows={3}
                      maxLength={12000}
                    />
                  </PortfolioField>
                  <PortfolioField
                    label={translate('portfolio.sourceReference', 'Jira or source reference')}
                  >
                    <Input
                      value={draft.sourceReference}
                      onChange={(event) => field('sourceReference', event.target.value)}
                      maxLength={2000}
                    />
                  </PortfolioField>
                  <p className="text-xs text-muted-foreground">
                    {translate(
                      'portfolio.referenceOnlyHint',
                      'Paste requirements and reference links here. Links are not imported or analyzed automatically. An improvement should describe the complete proposed specification before publication.'
                    )}
                  </p>
                </>
              )}
            </fieldset>
            {(error || saveError) && (
              <p role="alert" className="text-sm text-destructive">
                {error || saveError}
              </p>
            )}
            <PortfolioProjectSetupFooter
              discardPrompt={translate(
                'portfolio.discardFeatureDraft',
                'Discard this form draft? Saved features and work items will remain.'
              )}
              disabled={busy}
              canSave={!!(isItem ? draft.title : draft.name).trim()}
              saving={busy}
              showSave
              onClose={onClose}
              onDiscard={() => {
                discard()
                onClose()
              }}
            />
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
