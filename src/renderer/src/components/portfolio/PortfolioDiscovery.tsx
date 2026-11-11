import { CommentMarkdownAsync } from '@/components/sidebar/comment-markdown-lazy'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'

function conclusionText(state: PortfolioState, item: PortfolioWorkItem): string | undefined {
  const { conclusion } = item
  switch (conclusion?.outcome) {
    case 'work':
      return translate('portfolio.concludedWork', 'Concluded: became the work on this outcome.')
    case 'ticket':
      return translate('portfolio.concludedTicket', 'Concluded: ticket {{ticket}} for later.', {
        ticket: conclusion.reference ?? ''
      })
    case 'note':
      return translate('portfolio.concludedNote', 'Concluded: note “{{note}}” for later.', {
        note:
          state.notes.find((note) => note.id === conclusion.reference)?.title ??
          conclusion.reference ??
          ''
      })
    default:
      return undefined
  }
}

// What a discovery found with the steward, and how it ended; kept after it becomes work.
export function PortfolioDiscovery({
  state,
  item
}: {
  state: PortfolioState
  item: PortfolioWorkItem
}): React.JSX.Element | null {
  const conclusion = conclusionText(state, item)
  if (!item.findings && !conclusion) {
    return null
  }
  const findings = item.findings ? (
    <CommentMarkdownAsync content={item.findings} variant="document" className="text-sm" />
  ) : (
    <p className="text-sm text-muted-foreground">
      {translate('portfolio.discoveryNoFindings', 'No findings were recorded.')}
    </p>
  )
  const title = translate('portfolio.discoveryFindings', 'Discovery findings')
  // Once concluded, the findings are background for the work, so they fold behind one line.
  if (conclusion) {
    return (
      <details
        aria-label={translate('portfolio.discoverySection', 'Discovery')}
        className="rounded-md border border-border p-3"
      >
        <summary className="cursor-pointer text-sm">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground"> · {conclusion}</span>
        </summary>
        <div className="mt-3">{findings}</div>
      </details>
    )
  }
  return (
    <section
      aria-label={translate('portfolio.discoverySection', 'Discovery')}
      className="space-y-2 rounded-md border border-border p-3"
    >
      <h4 className="text-sm font-medium">{title}</h4>
      {findings}
    </section>
  )
}
