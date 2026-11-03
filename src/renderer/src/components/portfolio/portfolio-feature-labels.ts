import { translate } from '@/i18n/i18n'

export function workItemKinds() {
  return [
    { id: 'initial', name: translate('portfolio.initialDelivery', 'New capability') },
    { id: 'bug', name: translate('portfolio.bug', 'Bug') },
    { id: 'improvement', name: translate('portfolio.improvement', 'Improvement') },
    { id: 'investigation', name: translate('portfolio.investigation', 'Needs triage') },
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
export function workItemStatuses() {
  return [
    { id: 'planned', name: translate('portfolio.planned', 'Planned') },
    { id: 'active', name: translate('portfolio.activeWork', 'Active') },
    { id: 'blocked', name: translate('portfolio.blocked', 'Blocked') },
    { id: 'review', name: translate('portfolio.review', 'In review') },
    { id: 'accepted', name: translate('portfolio.accepted', 'Accepted') }
  ]
}
