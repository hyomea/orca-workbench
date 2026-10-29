import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { PortfolioContextSources } from './PortfolioContextSources'
import type { PortfolioJiraPreview } from './portfolio-context-sources'

function Preview({ design = false }: { design?: boolean }) {
  const [mode, setMode] = useState(design ? 'design' : 'jira')
  const [url, setUrl] = useState(
    design ? 'https://www.figma.com/design/example/Event-reports?node-id=1-2' : 'MOBILE-123'
  )
  const [references, setReferences] = useState('Preserve native navigation on each platform.')
  const [preview, setPreview] = useState<PortfolioJiraPreview | undefined>(
    design
      ? undefined
      : {
          key: 'MOBILE-123',
          title: 'Show sold and remaining seats in event reports',
          description:
            'As a box office operator, I want to see sold and remaining counts.\n\n## Acceptance criteria\n- Show both counts for the selected event time.\n- Refresh both counters after a sale.\n- Use the same test data on iOS and Android.',
          criteria:
            '- Show both counts for the selected event time.\n- Refresh both counters after a sale.\n- Use the same test data on iOS and Android.',
          url: 'https://example.atlassian.net/browse/MOBILE-123',
          updatedAt: '2026-10-29T15:00:00Z',
          clipped: false
        }
  )
  return (
    <div className="space-y-4 bg-background p-4 text-foreground">
      <PortfolioContextSources
        mode={mode}
        url={url}
        preview={preview}
        designReferences={references}
        busy={false}
        onMode={setMode}
        onUrl={setUrl}
        onPreview={setPreview}
        onAnalyze={async () => {}}
        onDesignReferences={setReferences}
        onPending={() => {}}
      />
      {design && <p className="whitespace-pre-wrap break-words text-sm">{references}</p>}
    </div>
  )
}
export const jiraPreview = defineFixture({ width: 560, render: () => <Preview /> })
export const jiraNarrow = defineFixture({ width: 360, render: () => <Preview /> })
export const designLink = defineFixture({
  width: 560,
  render: () => <Preview design />,
  interact: async (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'Read and fill draft'
    )
    if (!button) {
      throw new Error('Design attachment action missing')
    }
    button.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
})
