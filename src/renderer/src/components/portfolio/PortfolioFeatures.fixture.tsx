import { PortfolioDesignContext } from './portfolio-design-actions'
import { PortfolioComposer } from './PortfolioComposer'
import { useState } from 'react'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { applyPortfolioCommand, emptyPortfolio } from '../../../../shared/portfolio'
import { verificationTaskSnapshot } from '../../../../shared/portfolio-verification'
import { PortfolioFeatures } from './PortfolioFeatures'

function fixtureState() {
  const state = emptyPortfolio()
  state.projects.push({
    id: 'project',
    name: 'Mobile',
    objective: 'Consistent reporting',
    repoIds: []
  })
  state.roles.push({
    id: 'ios',
    name: 'iOS Engineer',
    responsibility: 'Implement and verify',
    agent: 'codex'
  })
  state.features.push({
    id: 'reports',
    projectId: 'project',
    name: 'Event reports',
    description: 'Shared reporting behavior for iOS and Android.',
    versions: [
      {
        version: 1,
        workItemId: 'first',
        description: 'Display event sales and remaining inventory.',
        acceptanceCriteria: 'Counts use the same event and ticket inventory snapshot.',
        designReferences: 'Reporting design / summary section',
        sourceReference: 'DEMO-123',
        at: 1,
        note: 'Reviewed initial delivery'
      }
    ]
  })
  state.features.push(
    {
      id: 'scanning',
      projectId: 'project',
      name: 'Ticket scanning',
      description:
        'Check entry eligibility and handle duplicate scans consistently on both platforms.',
      versions: []
    },
    {
      id: 'concessions',
      projectId: 'project',
      name: 'Concessions',
      description: 'Sell food and merchandise from the box office.',
      versions: []
    }
  )
  for (const [id, kind, title] of [
    ['bug', 'bug', 'Refresh leaves the sold count unchanged'],
    ['improvement', 'improvement', 'Add a breakdown by ticket type']
  ] as const) {
    state.workItems.push({
      id,
      projectId: state.features.find((feature) => feature.id === 'reports')!.projectId,
      featureId: 'reports',
      kind,
      title,
      description:
        kind === 'bug'
          ? 'After a new sale, refreshing the report should show the updated count.'
          : 'Show the totals for each ticket type without changing the overall event totals.',
      acceptanceCriteria: 'Both platforms show the expected counts for the same test data.',
      designReferences: 'Design notes and screenshots will be reviewed with the AC.',
      tickets: [
        { platform: 'ios', reference: 'DEMO-124' },
        { platform: 'android', reference: 'DEMO-125' }
      ],
      parity: true,
      designAttachments: [
        {
          id: 'a'.repeat(64),
          name: 'Event report – shared design.png',
          mimeType: 'image/png',
          bytes: 68
        }
      ],
      baseVersion: 1,
      status: 'planned',
      history: [{ id: `${id}:0`, at: 1, status: 'planned', note: 'Work item created' }]
    })
  }
  applyPortfolioCommand(
    state,
    {
      kind: 'verification.plan',
      workItemId: 'bug',
      expectedVersion: 0,
      scenarios: [
        {
          id: 'refresh',
          criterion: 'Refresh updates sold and remaining counts',
          testData: 'Event A, capacity 100, initially 20 sold',
          steps: 'Sell one ticket, then refresh the report',
          expected: '21 sold and 79 remaining',
          platformNotes: 'Use native refresh controls on each platform'
        }
      ],
      note: 'Cover the reported refresh regression'
    },
    'plan',
    1
  )
  applyPortfolioCommand(
    state,
    {
      kind: 'verification.confirm',
      workItemId: 'bug',
      planVersion: 1,
      note: 'Compared with AC and refresh designs'
    },
    'confirm',
    2
  )
  for (const platform of ['ios', 'android'] as const) {
    applyPortfolioCommand(
      state,
      {
        kind: 'verification.record',
        workItemId: 'bug',
        planVersion: 1,
        expectedTaskSnapshot: verificationTaskSnapshot(state, 'bug'),
        result: {
          scenarioId: 'refresh',
          platform,
          outcome: platform === 'ios' ? 'pass' : 'fail',
          build: 'Report preview build 18',
          environment:
            platform === 'ios'
              ? 'iPhone simulator / iOS / staging'
              : 'Pixel emulator / Android / staging',
          evidence:
            platform === 'ios'
              ? 'Observed 21 sold and 79 remaining after refresh.'
              : 'Sold count remains at 20 after refresh. See regression log and screenshot.'
        }
      },
      platform,
      3
    )
  }
  applyPortfolioCommand(
    state,
    {
      kind: 'verification.review',
      workItemId: 'bug',
      resultId: 'ios',
      decision: 'approved',
      note: 'Reviewed the count and refresh evidence'
    },
    'review',
    4
  )
  return state
}
function Preview({ initial = false }: { initial?: boolean }) {
  const [state, setState] = useState(() => {
    const state = fixtureState()
    if (initial) {
      state.features[0].versions = []
      state.workItems = [
        {
          ...state.workItems[0],
          kind: 'initial',
          title: 'Show sold and remaining seats',
          baseVersion: 0
        }
      ]
    }
    return state
  })
  const [scope] = useState(createBrowserUuid)
  return (
    <div className="@container/project min-h-[800px] bg-background p-6 text-foreground">
      <PortfolioDesignContext
        value={{
          attach: async () => true,
          remove: async () => true,
          read: async () =>
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII='
        }}
      >
        <PortfolioFeatures
          state={state}
          projectId="project"
          draftScope={scope}
          busy={false}
          error=""
          onSave={async (command) => {
            const next = structuredClone(state)
            applyPortfolioCommand(next, command, createBrowserUuid(), Date.now())
            setState(next)
            return true
          }}
          onCreateTask={() => {}}
          onSelectTask={() => {}}
          onCreateRole={() => {}}
          onOpenTasks={() => {}}
          onDiscuss={() => {}}
        />
      </PortfolioDesignContext>
    </div>
  )
}
async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((entry) =>
    entry.textContent?.includes(label)
  )
  if (!button) {
    throw new Error(`Missing fixture action: ${label}`)
  }
  if (button.getAttribute('role') === 'tab') {
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  }
  button.click()
  await new Promise((resolve) => requestAnimationFrame(resolve))
}
export const featureList = defineFixture({ width: 1100, render: () => <Preview /> })
export const featureListNarrow = defineFixture({ width: 390, render: () => <Preview /> })
export const workItemList = defineFixture({
  width: 1100,
  render: () => <Preview />,
  interact: () => click('Event reports')
})
export const workItemListNarrow = defineFixture({
  width: 390,
  render: () => <Preview />,
  interact: () => click('Event reports')
})
export const initialWorkItem = defineFixture({
  width: 1100,
  render: () => <Preview initial />,
  interact: () => click('Event reports')
})
export const bugDetail = defineFixture({
  width: 1100,
  render: () => <Preview />,
  interact: async () => {
    await click('Event reports')
    await click('Refresh leaves')
  }
})
export const narrow = defineFixture({
  width: 390,
  render: () => <Preview />,
  interact: async () => {
    await click('Event reports')
    await click('Refresh leaves')
  }
})
export const newWorkItem = defineFixture({
  width: 1100,
  render: () => <Preview />,
  interact: async () => {
    await click('Event reports')
    await click('New outcome')
  }
})

async function showParity() {
  await click('Event reports')
  await click('Refresh leaves')
  await click('Parity & tests')
  await click('Android')
}
export const parity = defineFixture({
  width: 1100,
  render: () => <Preview />,
  interact: showParity
})
export const parityNarrow = defineFixture({
  width: 390,
  render: () => <Preview />,
  interact: showParity
})
export const recordResult = defineFixture({
  width: 700,
  render: () => <Preview />,
  interact: async () => {
    await showParity()
    await click('Record test result')
  }
})

export const designAttachments = defineFixture({
  width: 700,
  render: () => <Preview />,
  interact: async () => {
    await click('Event reports')
    await click('Add a breakdown')
    document
      .querySelector('[aria-label="Choose design image"]')
      ?.parentElement?.scrollIntoView({ block: 'center' })
  }
})
export const roleTemplate = defineFixture({
  width: 700,
  render: () => (
    <PortfolioComposer
      kind="role"
      state={fixtureState()}
      projectId="project"
      busy={false}
      saveError=""
      onClose={() => {}}
      onSave={async () => true}
    />
  ),
  interact: async () => {
    await click('Apply template')
  }
})
