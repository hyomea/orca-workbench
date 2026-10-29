import { translate } from '@/i18n/i18n'

export function workItemKinds() {
  return [
    { id: 'initial', name: translate('portfolio.initialDelivery', 'Initial delivery') },
    { id: 'bug', name: translate('portfolio.bug', 'Bug') },
    { id: 'improvement', name: translate('portfolio.improvement', 'Improvement') },
    { id: 'investigation', name: translate('portfolio.investigation', 'Needs triage') }
  ]
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
