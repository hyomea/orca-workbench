import { useTranslate } from '@/i18n/use-translate'

// A finished turn nobody has looked at yet; the same unread state that bolds the row's text.
export function AgentUnreadDot(): React.JSX.Element {
  const t = useTranslate()
  const label = t('sidebar.agentUnread', 'Unread')
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="size-1.5 shrink-0 rounded-full bg-destructive"
    />
  )
}
