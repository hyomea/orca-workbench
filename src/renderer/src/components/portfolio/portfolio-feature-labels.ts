import { translate } from '@/i18n/i18n'
import type { PortfolioTicketRole } from '../../../../shared/portfolio-features'

export function workItemKinds() {
  return [
    { id: 'initial', name: translate('portfolio.initialDelivery', 'New capability') },
    { id: 'bug', name: translate('portfolio.bug', 'Bug') },
    { id: 'improvement', name: translate('portfolio.improvement', 'Improvement') },
    { id: 'investigation', name: translate('portfolio.discovery', 'Discovery') },
    { id: 'engineering', name: translate('portfolio.engineering', 'Engineering') }
  ]
}
export function workPlatformName(platform: string): string {
  switch (platform) {
    case 'ios':
      return 'iOS'
    case 'android':
      return 'Android'
    case 'backend':
      return translate('portfolio.platformBackend', 'Backend')
    default:
      return translate('portfolio.platformShared', 'Shared')
  }
}
export function ticketRoleName(role: PortfolioTicketRole): string {
  switch (role) {
    case 'author':
      return translate('portfolio.roleAuthor', 'You build it')
    case 'reviewer':
      return translate('portfolio.roleReviewer', 'You review it')
    case 'tracking':
      return translate('portfolio.roleTracking', 'You track it')
  }
}
export function workItemStatuses() {
  return [
    { id: 'planned', name: translate('portfolio.planned', 'Planned') },
    { id: 'active', name: translate('portfolio.activeWork', 'Active') },
    { id: 'blocked', name: translate('portfolio.blocked', 'Blocked') },
    { id: 'review', name: translate('portfolio.review', 'In review') },
    { id: 'accepted', name: translate('portfolio.accepted', 'Accepted') }
  ]
}
