import { defineFixture } from '../../component-fixtures/component-fixture'
import { PortfolioBoard } from './PortfolioBoard'
import { emptyPortfolio, type PortfolioState } from '../../../../shared/portfolio'

const state: PortfolioState = {
  ...emptyPortfolio(),
  organization: 'Product engineering',
  projects: [
    {
      id: 'identity',
      name: 'Identity platform',
      objective: 'One identity across web, mobile, and the box office.',
      repoIds: ['api', 'mobile']
    },
    {
      id: 'checkout',
      name: 'Unified checkout',
      objective: 'One cart across purchases.',
      repoIds: ['api']
    }
  ],
  roles: [
    {
      id: 'architect',
      name: 'Architect',
      agent: 'claude',
      responsibility: 'Define contracts and review system boundaries.'
    },
    {
      id: 'engineer',
      name: 'Engineer',
      agent: 'codex',
      responsibility: 'Implement and verify scoped changes.'
    }
  ],
  tasks: [
    {
      id: '1',
      projectId: 'identity',
      roleId: 'architect',
      title: 'Define the session contract',
      instructions: 'Document token and session lifecycle.',
      acceptanceCriteria: 'Reviewed against web and mobile flows.',
      status: 'accepted',
      evidence: 'Contract reviewed.',
      attempts: [],
      history: []
    },
    {
      id: '2',
      projectId: 'identity',
      roleId: 'engineer',
      title: 'Implement the identity adapter',
      instructions: 'Implement the agreed contract.',
      acceptanceCriteria: 'Integration tests pass.',
      status: 'running',
      evidence: '',
      attempts: [],
      history: []
    },
    {
      id: '3',
      projectId: 'identity',
      roleId: 'engineer',
      title: 'Verify mobile sign in',
      instructions: 'Exercise the session lifecycle.',
      acceptanceCriteria: 'Refresh and sign out verified.',
      status: 'review',
      evidence: 'Test evidence attached.',
      attempts: [],
      history: []
    },
    {
      id: '4',
      projectId: 'identity',
      roleId: 'architect',
      title: 'Review account migration',
      instructions: 'Identify migration requirements.',
      acceptanceCriteria: 'Migration plan agreed.',
      status: 'blocked',
      evidence: '',
      attempts: [],
      history: []
    },
    {
      id: '5',
      projectId: 'identity',
      roleId: 'engineer',
      title: 'Add box office integration',
      instructions: 'Connect the identity adapter.',
      acceptanceCriteria: 'Operator flow verified.',
      status: 'todo',
      evidence: '',
      attempts: [],
      history: []
    }
  ]
}

function board(value: PortfolioState): React.JSX.Element {
  return (
    <div className="h-[800px]">
      <PortfolioBoard
        state={value}
        repos={[
          { id: 'api', name: 'Next API' },
          { id: 'mobile', name: 'Mobile' }
        ]}
        workspaces={[]}
        activity={{}}
        busy={false}
        error=""
        onRefresh={() => {}}
        onSave={async () => true}
        onLaunch={async () => true}
        onOpenWorkspace={() => {}}
      />
    </div>
  )
}
export const populated = defineFixture({ width: 1200, render: () => board(state) })
export const empty = defineFixture({ width: 1100, render: () => board(emptyPortfolio()) })
export const narrow = defineFixture({ width: 390, render: () => board(state) })
export const newProject = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'New project'
    )
    if (!button) {
      throw new Error('New project action missing')
    }
    button.click()
  }
})
export const review = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: (frame) => {
    const button = [...frame.querySelectorAll('button')].find((entry) =>
      entry.textContent?.includes('Verify mobile sign in')
    )
    if (!button) {
      throw new Error('Review task missing')
    }
    button.click()
  }
})
