import { defineFixture } from '../../component-fixtures/component-fixture'
import { PortfolioIntakeReview } from './PortfolioIntakeReview'

const fields = {
  title: 'Show sold and remaining seats',
  description: 'Give box office operators consistent event reporting on iOS and Android.',
  acceptanceCriteria:
    'Show sold and remaining counts for the selected event time. Refresh both after a sale.',
  designReferences: 'https://www.figma.com/design/example/Reports',
  sourceReference: 'https://example.atlassian.net/browse/MOBILE-123'
}
function Review() {
  return (
    <div className="bg-background p-4 text-foreground">
      <PortfolioIntakeReview
        editor={{
          draft: {
            name: '',
            kind: 'improvement',
            ...fields,
            intakeSources: [
              {
                url: fields.sourceReference,
                title: fields.title,
                content: fields.description,
                clipped: false
              }
            ],
            intakeResult: {
              fields,
              questions: ['Should refunded tickets count toward the sold total?'],
              sources: [
                {
                  url: fields.sourceReference,
                  status: 'read',
                  detail: 'Show sold and remaining counts for each event time.'
                },
                {
                  url: fields.designReferences,
                  status: 'unavailable',
                  detail: 'Figma access is not configured for this agent.'
                }
              ]
            }
          },
          field: () => {},
          setTickets: () => {},
          setParity: () => {},
          discard: Object.assign(() => {}, {
            capture: () => undefined as never,
            complete: () => {}
          }),
          preview: () => {},
          reference: () => {},
          rememberSources: () => {},
          applyIntake: () => {}
        }}
        intake={{ pending: false, error: '', analyze: async () => {}, stop: async () => {} }}
        busy={false}
      />
    </div>
  )
}
export const review = defineFixture({ width: 560, render: () => <Review /> })
export const narrow = defineFixture({ width: 360, render: () => <Review /> })
