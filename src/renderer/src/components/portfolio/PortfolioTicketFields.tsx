import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { PortfolioTicket, PortfolioTicketRole } from '../../../../shared/portfolio-features'
import { PortfolioSelect } from './portfolio-controls'
import { ticketRoleName, workPlatformName } from './portfolio-feature-labels'

const PLATFORMS = ['ios', 'android', 'backend'] as const
const ROLES = ['author', 'reviewer', 'tracking'] as const
export type PortfolioTicketDraft = {
  platforms: string[]
  refs: Record<string, string>
  // The user's part per platform, and the teammate's PR when the user reviews or tracks it.
  roles: Record<string, PortfolioTicketRole>
  prs: Record<string, string>
  // A reference that names no single platform, such as an imported Jira link.
  other: string
}

export function ticketDraft(tickets: readonly PortfolioTicket[]): PortfolioTicketDraft {
  return {
    platforms: tickets.flatMap((ticket) => (ticket.platform ? [ticket.platform] : [])),
    refs: Object.fromEntries(
      tickets.flatMap((ticket) => (ticket.platform ? [[ticket.platform, ticket.reference]] : []))
    ),
    roles: Object.fromEntries(
      tickets.flatMap((ticket) =>
        ticket.platform && ticket.role ? [[ticket.platform, ticket.role]] : []
      )
    ),
    prs: Object.fromEntries(
      tickets.flatMap((ticket) =>
        ticket.platform && ticket.pr ? [[ticket.platform, ticket.pr]] : []
      )
    ),
    other: tickets
      .filter((ticket) => !ticket.platform)
      .map((ticket) => ticket.reference)
      .join('\n')
  }
}

export function ticketsFromDraft(draft: PortfolioTicketDraft): PortfolioTicket[] {
  return [
    ...PLATFORMS.filter((platform) => draft.platforms.includes(platform)).map((platform) => {
      const role = draft.roles[platform] ?? 'author'
      const pr = draft.prs[platform]?.trim()
      return {
        platform,
        reference: draft.refs[platform]?.trim() ?? '',
        ...(role === 'author' ? {} : { role, ...(pr ? { pr } : {}) })
      }
    }),
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
  team,
  onChange
}: {
  value: PortfolioTicketDraft
  disabled?: boolean
  // A team initiative asks for the user's part on each platform.
  team?: boolean
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
        const role = value.roles[platform] ?? 'author'
        return (
          <div key={platform} className="space-y-2">
            <div className="flex items-center gap-3">
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
            {team && checked && (
              <div className="grid grid-cols-[10rem_1fr] items-end gap-3 pl-[7.75rem]">
                <PortfolioSelect
                  label={translate('portfolio.ticketRole', '{{platform}}: your part', {
                    platform: name
                  })}
                  value={role}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      roles: { ...value.roles, [platform]: next as PortfolioTicketRole }
                    })
                  }
                  options={ROLES.map((id) => ({ id, name: ticketRoleName(id) }))}
                />
                {role !== 'author' && (
                  <Input
                    type="url"
                    aria-label={translate('portfolio.ticketPr', '{{platform}} teammate PR', {
                      platform: name
                    })}
                    placeholder={translate('portfolio.ticketPrPlaceholder', 'Teammate’s PR link')}
                    value={value.prs[platform] ?? ''}
                    maxLength={2000}
                    onChange={(event) =>
                      onChange({ ...value, prs: { ...value.prs, [platform]: event.target.value } })
                    }
                  />
                )}
              </div>
            )}
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
