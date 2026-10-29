import type { PortfolioDesignAttachment } from '../../../../shared/portfolio-design'
import { PortfolioDesignAttachments } from './PortfolioDesignAttachments'
import { translate } from '@/i18n/i18n'

export function PortfolioSpecification({
  description,
  acceptanceCriteria,
  designReferences,
  sourceReference,
  designAttachments
}: {
  description: string
  acceptanceCriteria: string
  designReferences: string
  sourceReference: string
  designAttachments?: PortfolioDesignAttachment[]
}): React.JSX.Element {
  const sections = [
    {
      label: translate('portfolio.changeDescription', 'Problem or proposed change'),
      text: description
    },
    {
      label: translate('portfolio.acceptanceCriteria', 'Acceptance criteria'),
      text: acceptanceCriteria
    },
    {
      label: translate('portfolio.designReferences', 'Design references and notes'),
      text: designReferences
    },
    {
      label: translate('portfolio.sourceReference', 'Jira or source reference'),
      text: sourceReference
    }
  ]
  return (
    <div className="space-y-4">
      {sections
        .filter((entry) => entry.text)
        .map((entry) => (
          <section key={entry.label} className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">{entry.label}</h4>
            <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
          </section>
        ))}
      <PortfolioDesignAttachments attachments={designAttachments} />
    </div>
  )
}
