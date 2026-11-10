import { Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

// Keeps a ticket at the top of the Tasks page; shown on hover until it is pinned.
export function PortfolioTrackPin({
  pinned,
  label,
  onToggle
}: {
  pinned: boolean
  label: string
  onToggle: () => void
}): React.JSX.Element {
  const text = pinned
    ? translate('portfolio.unpinTrack', 'Unpin {{ticket}}', { ticket: label })
    : translate('portfolio.pinTrack', 'Pin {{ticket}} to the top', { ticket: label })
  return (
    <button
      type="button"
      aria-label={text}
      title={text}
      aria-pressed={pinned}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        'rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
        pinned ? 'opacity-100' : 'opacity-0 group-hover/track:opacity-100'
      )}
    >
      {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
    </button>
  )
}
