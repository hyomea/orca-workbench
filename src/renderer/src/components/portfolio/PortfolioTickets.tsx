import { Badge } from '@/components/ui/badge'
import type { PortfolioTicket } from '../../../../shared/portfolio-features'
import { ticketRoleName, workPlatformName } from './portfolio-feature-labels'
import { portfolioTicketLabel } from './portfolio-tracks'

// The outcome's tickets, one per platform, so the user sees where each side of the work lives.
export function PortfolioTickets({
  tickets
}: {
  tickets: readonly PortfolioTicket[]
}): React.JSX.Element | null {
  if (!tickets.length) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {tickets.map((ticket, index) => (
        <li key={`${ticket.platform ?? ''}:${index}`}>
          <Badge variant="secondary" className="max-w-full gap-1 font-normal">
            {ticket.platform && (
              <span className="font-medium">{workPlatformName(ticket.platform)}</span>
            )}
            {/* A Jira link reads as its key; the full reference stays on hover. */}
            <span className="truncate" title={ticket.reference || undefined}>
              {ticket.reference ? portfolioTicketLabel(ticket.reference) : '—'}
            </span>
            {ticket.role && ticket.role !== 'author' && (
              <span className="text-muted-foreground">· {ticketRoleName(ticket.role)}</span>
            )}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
