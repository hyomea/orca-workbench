import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { Input } from '@/components/ui/input'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { PortfolioTicketFields, ticketDraft, ticketsFromDraft } from './PortfolioTicketFields'

// Tickets, parity, and the feature link change as work proceeds, unlike the outcome's definition.
export function PortfolioOutcomeScope({
  item,
  features,
  busy,
  onSave,
  onClose
}: {
  item: PortfolioWorkItem
  features: readonly PortfolioFeature[]
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const [tickets, setTickets] = useState(() => ticketDraft(item.tickets))
  const [parity, setParity] = useState(item.parity)
  const [featureId, setFeatureId] = useState(item.featureId ?? 'none')
  const [qaFeedbackUrl, setQaFeedbackUrl] = useState(item.qaFeedbackUrl ?? '')
  return (
    <form
      className="space-y-4 rounded-md border border-border p-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (
          await onSave({
            kind: 'workItem.scope',
            workItemId: item.id,
            tickets: ticketsFromDraft(tickets),
            parity,
            feature: featureId === 'none' ? null : featureId,
            qaFeedbackUrl: qaFeedbackUrl.trim() || null
          })
        ) {
          onClose()
        }
      }}
    >
      <PortfolioTicketFields value={tickets} disabled={busy} onChange={setTickets} />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={parity} onCheckedChange={(checked) => setParity(checked === true)} />
        {translate('portfolio.parityOutcome', 'iOS and Android must behave the same')}
      </label>
      <PortfolioSelect
        label={translate('portfolio.outcomeFeatureLink', 'Feature (optional)')}
        value={featureId}
        onChange={setFeatureId}
        disabled={busy}
        options={[
          { id: 'none', name: translate('portfolio.noFeature', 'No feature') },
          ...features.map((entry) => ({ id: entry.id, name: entry.name }))
        ]}
      />
      <PortfolioField
        label={translate('portfolio.qaFeedbackLink', 'External QA feedback link (optional)')}
      >
        <Input
          type="url"
          value={qaFeedbackUrl}
          disabled={busy}
          placeholder="https://www.notion.so/…"
          onChange={(event) => setQaFeedbackUrl(event.target.value)}
        />
      </PortfolioField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose}>
          {translate('portfolio.cancel', 'Cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {translate('portfolio.save', 'Save')}
        </Button>
      </div>
    </form>
  )
}
