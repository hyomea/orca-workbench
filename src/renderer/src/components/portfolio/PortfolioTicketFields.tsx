import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { PortfolioTicket } from '../../../../shared/portfolio-features'
import { workPlatformName } from './portfolio-feature-labels'

const PLATFORMS = ['ios', 'android', 'backend'] as const
export type PortfolioTicketDraft = {
  platforms: string[]
  refs: Record<string, string>
  // A reference that names no single platform, such as an imported Jira link.
  other: string
}

export function ticketDraft(tickets: readonly PortfolioTicket[]): PortfolioTicketDraft {
  return {
    platforms: tickets.flatMap((ticket) => (ticket.platform ? [ticket.platform] : [])),
    refs: Object.fromEntries(
      tickets.flatMap((ticket) => (ticket.platform ? [[ticket.platform, ticket.reference]] : []))
    ),
    other: tickets
      .filter((ticket) => !ticket.platform)
      .map((ticket) => ticket.reference)
      .join('\n')
  }
}

export function ticketsFromDraft(draft: PortfolioTicketDraft): PortfolioTicket[] {
  return [
    ...PLATFORMS.filter((platform) => draft.platforms.includes(platform)).map((platform) => ({
      platform,
      reference: draft.refs[platform]?.trim() ?? ''
    })),
    ...(draft.other.trim() ? [{ reference: draft.other.trim() }] : [])
  ]
}

function ticketLabel(platform: (typeof PLATFORMS)[number]): string {
  switch (platform) {
    case 'ios':
      return translate('portfolio.iosTicket', 'iOS ticket')
    case 'android':
      return translate('portfolio.androidTicket', 'Android ticket')
    case 'backend':
      return translate('portfolio.backendTicket', 'Backend ticket')
  }
}

export function PortfolioTicketFields({
  value,
  disabled,
  onChange
}: {
  value: PortfolioTicketDraft
  disabled?: boolean
  onChange: (value: PortfolioTicketDraft) => void
}): React.JSX.Element {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">
        {translate('portfolio.outcomePlatforms', 'Platforms and tickets')}
      </legend>
      {PLATFORMS.map((platform) => {
        const checked = value.platforms.includes(platform)
        const name = workPlatformName(platform)
        return (
          <div key={platform} className="flex items-center gap-3">
            <label className="flex w-28 shrink-0 items-center gap-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(next) =>
                  onChange({
                    ...value,
                    platforms: next
                      ? [...value.platforms, platform]
                      : value.platforms.filter((entry) => entry !== platform)
                  })
                }
              />
              {name}
            </label>
            <Input
              aria-label={ticketLabel(platform)}
              placeholder={translate('portfolio.ticketPlaceholder', 'Ticket key or link')}
              value={value.refs[platform] ?? ''}
              disabled={!checked}
              maxLength={2000}
              onChange={(event) =>
                onChange({ ...value, refs: { ...value.refs, [platform]: event.target.value } })
              }
            />
          </div>
        )
      })}
      <label className="flex flex-col gap-2 text-sm">
        <span>{translate('portfolio.otherReference', 'Other reference')}</span>
        <Input
          value={value.other}
          maxLength={2000}
          onChange={(event) => onChange({ ...value, other: event.target.value })}
        />
      </label>
    </fieldset>
  )
}
