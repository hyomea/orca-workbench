import { Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

// Keeps a ticket or an outcome at the top of its list; shown on hover until it is pinned.
export function PortfolioPin({
  pinned,
  label,
  onToggle
}: {
  pinned: boolean
  label: string
  onToggle: () => void
}): React.JSX.Element {
  const text = pinned
    ? translate('portfolio.unpin', 'Unpin {{name}}', { name: label })
    : translate('portfolio.pinToTop', 'Pin {{name}} to the top', { name: label })
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
        pinned ? 'opacity-100' : 'opacity-0 group-hover/pin:opacity-100'
      )}
    >
      {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
    </button>
  )
}
