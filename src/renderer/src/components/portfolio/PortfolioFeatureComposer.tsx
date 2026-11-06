import { PortfolioIntakeReview } from './PortfolioIntakeReview'
import { usePortfolioIntake } from './use-portfolio-intake'
import { PortfolioContextSources } from './PortfolioContextSources'
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
import type { PortfolioWorkItem, PortfolioFeature } from '../../../../shared/portfolio-features'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { PortfolioProjectSetupFooter } from './PortfolioProjectSetupFooter'
import { workItemKinds } from './portfolio-feature-labels'
import { useFeatureDraft } from './use-feature-draft'
import { Checkbox } from '@/components/ui/checkbox'
import { PortfolioTicketFields, ticketsFromDraft } from './PortfolioTicketFields'

const NO_FEATURES: readonly PortfolioFeature[] = []
export function PortfolioFeatureComposer({
  mode,
  projectId,
  featureId,
  features = NO_FEATURES,
  feature,
  item,
  draftKey,
  hasSpecification,
  specification,
  busy,
  saveError,
  onSave,
  onClose
}: {
  // An outcome is a piece of work; a feature is the product capability some outcomes change.
  mode: 'outcome' | 'feature'
  projectId: string
  featureId?: string
  features?: readonly PortfolioFeature[]
  // Present when editing an existing feature.
  feature?: PortfolioFeature
  item?: PortfolioWorkItem
  draftKey: string
  hasSpecification?: boolean
  specification?: PortfolioFeature['versions'][number]
  busy: boolean
  saveError: string
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const [importing, setImporting] = useState(false)
  const editor = useFeatureDraft(
    draftKey,
    item,
    hasSpecification ? 'improvement' : 'initial',
    specification,
    featureId,
    feature
  )
  const { draft, field, discard, preview } = editor
  const intake = usePortfolioIntake(editor)
  const working = busy || importing || intake.pending
  const [error, setError] = useState('')
  const isItem = mode === 'outcome'
  const tickets = {
    platforms: draft.platforms ?? [],
    refs: draft.ticketRefs ?? {},
    roles: draft.ticketRoles ?? {},
    prs: draft.ticketPrs ?? {},
    other: draft.sourceReference
  }
  async function save(): Promise<void> {
    if (working) {
      return
    }
    const workItem = {
      projectId,
      ...(draft.featureId ? { featureId: draft.featureId } : {}),
      kind: draft.kind,
      title: draft.title,
      description: draft.description,
      acceptanceCriteria: draft.acceptanceCriteria,
      designReferences: draft.designReferences,
      tickets: ticketsFromDraft(tickets),
      parity: draft.parity ?? false
    }
    const parsed = PortfolioCommand.safeParse(
      isItem
        ? item
          ? { kind: 'workItem.update', workItemId: item.id, workItem, expected: draft.expected }
          : { kind: 'workItem.create', workItem, expectedBaseVersion: draft.baseVersion ?? 0 }
        : feature
          ? {
              kind: 'feature.update',
              featureId: feature.id,
              feature: { name: draft.name, description: draft.description },
              expected: { name: feature.name, description: feature.description }
            }
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
        if (!open && !working) {
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
                  ? translate('portfolio.editOutcome', 'Edit outcome')
                  : translate('portfolio.newOutcome', 'New outcome')
                : feature
                  ? translate('portfolio.editFeature', 'Edit feature')
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
            {isItem && <PortfolioIntakeReview editor={editor} intake={intake} busy={working} />}
            {isItem && (
              <PortfolioContextSources
                mode={draft.contextKind ?? ''}
                url={draft.contextUrl ?? ''}
                preview={draft.contextPreview}
                designReferences={draft.designReferences}
                busy={busy || intake.pending}
                onMode={(value) => field('contextKind', value)}
                onUrl={(value) => field('contextUrl', value)}
                onPreview={preview}
                onAnalyze={intake.analyze}
                onDesignReferences={editor.reference}
                onPending={setImporting}
              />
            )}
            <fieldset disabled={working} className="space-y-5">
              {isItem && (
                <PortfolioSelect
                  label={translate('portfolio.workItemType', 'Work type')}
                  value={draft.kind}
                  onChange={(value) => field('kind', value)}
                  options={workItemKinds().filter(
                    (kind) => !hasSpecification || kind.id !== 'initial'
                  )}
                  disabled={working}
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
                  <PortfolioTicketFields
                    value={tickets}
                    disabled={working}
                    onChange={editor.setTickets}
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={draft.parity ?? false}
                      onCheckedChange={(checked) => editor.setParity(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">
                        {translate(
                          'portfolio.parityOutcome',
                          'iOS and Android must behave the same'
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {translate(
                          'portfolio.parityOutcomeHint',
                          'Requires a shared test plan with reviewed evidence on both platforms before acceptance. Leave it off for platform-specific or engineering work.'
                        )}
                      </span>
                    </span>
                  </label>
                  {!item?.featureId && features.length > 0 && (
                    <PortfolioSelect
                      label={translate('portfolio.outcomeFeatureLink', 'Feature (optional)')}
                      value={draft.featureId || 'none'}
                      onChange={(value) => field('featureId', value === 'none' ? '' : value)}
                      disabled={working}
                      options={[
                        {
                          id: 'none',
                          name: translate('portfolio.noFeature', 'No feature')
                        },
                        ...features.map((entry) => ({ id: entry.id, name: entry.name }))
                      ]}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {translate(
                      'portfolio.referenceReviewHint',
                      'Review imported requirements and design references before saving. Design links are references until inspected. An improvement should describe the complete proposed specification before publication.'
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
                'Discard this form draft? Saved features and outcomes will remain.'
              )}
              disabled={working}
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
