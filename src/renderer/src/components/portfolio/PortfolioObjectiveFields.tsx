import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { PortfolioField } from './portfolio-controls'

export function PortfolioObjectiveFields({
  name,
  objective,
  setName,
  setObjective,
  disabled
}: {
  name: string
  objective: string
  setName: (name: string) => void
  setObjective: (objective: string) => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <section className="space-y-4 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">
        {translate('portfolio.confirmObjective', 'Review and confirm')}
      </h3>
      <PortfolioField label={translate('portfolio.name', 'Name')}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={200}
          disabled={disabled}
        />
      </PortfolioField>
      <PortfolioField label={translate('portfolio.objective', 'Objective')}>
        <Textarea
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          required
          rows={5}
          maxLength={20000}
          disabled={disabled}
        />
      </PortfolioField>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.confirmObjectiveHint',
          'Only the objective you confirm is saved. New task executions use it; existing executions keep their original instructions.'
        )}
      </p>
    </section>
  )
}
