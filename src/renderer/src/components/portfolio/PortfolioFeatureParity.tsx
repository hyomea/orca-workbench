import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { PortfolioCommand } from '../../../../shared/portfolio'
import type { PortfolioFeature } from '../../../../shared/portfolio-features'
import {
  PortfolioParityStatus,
  type PortfolioFeatureParity as Parity,
  type PortfolioParityCheck
} from '../../../../shared/portfolio-feature-parity'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { parityStatusName } from './portfolio-parity-labels'

const PLATFORMS = [
  { id: 'ios', name: 'iOS' },
  { id: 'android', name: 'Android' }
] as const
const UNCHECKED: PortfolioParityCheck = { status: 'unknown', note: '', evidence: '' }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// The feature's row in the parity inventory, and the form that records a new check.
export function PortfolioFeatureParity({
  feature,
  busy,
  onSave
}: {
  feature: PortfolioFeature
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [draft, setDraft] = useState<Parity | null>(null)
  const [error, setError] = useState('')
  const parity = feature.parity
  function check(platform: 'ios' | 'android', change: Partial<PortfolioParityCheck>): void {
    setDraft(
      (current) => current && { ...current, [platform]: { ...current[platform], ...change } }
    )
  }
  async function save(): Promise<void> {
    const parsed = PortfolioCommand.safeParse({
      kind: 'feature.parity',
      featureId: feature.id,
      parity: draft
    })
    if (!parsed.success) {
      setError(
        translate(
          'portfolio.parityIncomplete',
          'Explain every status other than Same, and give evidence and a date for each platform you checked.'
        )
      )
      return
    }
    setError('')
    if (await onSave(parsed.data)) {
      setDraft(null)
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{translate('portfolio.parityStatus', 'Parity')}</h4>
        {!draft && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              setDraft(
                parity ?? {
                  ios: { ...UNCHECKED },
                  android: { ...UNCHECKED },
                  ruleLocation: '',
                  needsHardware: false
                }
              )
            }
          >
            {translate('portfolio.recordParity', 'Record a parity check')}
          </Button>
        )}
      </div>
      {!draft &&
        (parity ? (
          <dl className="grid gap-3 text-sm @2xl/project:grid-cols-2">
            {PLATFORMS.map(({ id, name }) => (
              <div key={id} className="space-y-1">
                <dt className="flex items-center gap-2 font-medium">
                  {name}
                  <Badge variant="outline">{parityStatusName(parity[id].status)}</Badge>
                  {parity[id].checkedOn && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {parity[id].checkedOn}
                    </span>
                  )}
                </dt>
                {parity[id].note && <dd className="whitespace-pre-wrap">{parity[id].note}</dd>}
                {parity[id].evidence && (
                  <dd className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {parity[id].evidence}
                  </dd>
                )}
              </div>
            ))}
            <div className="text-xs text-muted-foreground @2xl/project:col-span-2">
              {[
                parity.ruleLocation &&
                  translate('portfolio.ruleLocationValue', 'Business rule: {{location}}', {
                    location: parity.ruleLocation
                  }),
                parity.needsHardware && translate('portfolio.needsHardware', 'Needs real hardware')
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate(
              'portfolio.noParity',
              'Not checked yet. Record how this feature behaves on iOS and Android, with evidence.'
            )}
          </p>
        ))}
      {draft && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {PLATFORMS.map(({ id, name }) => (
            <fieldset key={id} className="space-y-3" disabled={busy}>
              <legend className="text-sm font-medium">{name}</legend>
              <PortfolioSelect
                label={translate('portfolio.parityStatusLabel', 'Status')}
                value={draft[id].status}
                onChange={(status) =>
                  check(id, {
                    status: PortfolioParityStatus.parse(status),
                    checkedOn: draft[id].checkedOn ?? today()
                  })
                }
                options={PortfolioParityStatus.options.map((status) => ({
                  id: status,
                  name: parityStatusName(status)
                }))}
              />
              <PortfolioField label={translate('portfolio.parityNote', 'What differs, or why')}>
                <Textarea
                  rows={2}
                  maxLength={4000}
                  value={draft[id].note}
                  onChange={(event) => check(id, { note: event.target.value })}
                />
              </PortfolioField>
              <PortfolioField label={translate('portfolio.parityEvidence', 'Evidence')}>
                <Textarea
                  rows={2}
                  maxLength={4000}
                  value={draft[id].evidence}
                  onChange={(event) => check(id, { evidence: event.target.value })}
                />
              </PortfolioField>
              <PortfolioField label={translate('portfolio.parityCheckedOn', 'Checked on')}>
                <Input
                  type="date"
                  value={draft[id].checkedOn ?? ''}
                  onChange={(event) => check(id, { checkedOn: event.target.value || undefined })}
                />
              </PortfolioField>
            </fieldset>
          ))}
          <PortfolioField
            label={translate('portfolio.ruleLocation', 'Where the business rule lives')}
          >
            <Input
              maxLength={4000}
              value={draft.ruleLocation}
              onChange={(event) => setDraft({ ...draft, ruleLocation: event.target.value })}
            />
          </PortfolioField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.needsHardware}
              onCheckedChange={(checked) => setDraft({ ...draft, needsHardware: checked === true })}
            />
            {translate('portfolio.needsHardware', 'Needs real hardware')}
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              {translate('portfolio.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {translate('portfolio.save', 'Save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
