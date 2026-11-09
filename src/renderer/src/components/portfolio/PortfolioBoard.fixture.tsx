import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
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
      stage: 'development',
      steps: [],
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
      stage: 'development',
      steps: [],
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
      stage: 'development',
      steps: [],
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
      stage: 'development',
      steps: [],
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
      stage: 'development',
      steps: [],
      attempts: [],
      history: []
    }
  ]
}

function board(value: PortfolioState, importExample = false, short = false): React.JSX.Element {
  return (
    <div className={short ? 'h-[480px]' : 'h-[800px]'}>
      <PortfolioBoard
        draftScope={createBrowserUuid()}
        state={value}
        repos={[
          { id: 'api', name: 'Next API' },
          { id: 'mobile', name: 'Mobile' }
        ]}
        workspaces={[]}
        activity={{}}
        busy={false}
        error=""
        onExportNotes={async () => null}
        onOpenSteward={() => {}}
        onOpenTasks={() => {}}
        onReviewChanges={() => {}}
        onOpenPersonalNotes={() => {}}
        onChoosePersonalNotesFolder={() => {}}
        setupActions={{
          pickSources: async () =>
            importExample ? [{ path: '/projects/arts-hub', name: 'Arts hub', kind: 'folder' }] : [],
          importSource: async (source) => ({ id: source.path, name: source.name }),
          discover: async () => ({
            draft: {
              name: 'Arts exploration',
              summary: 'The selected directories contain prototypes and research.',
              objective: 'Explore and validate new possibilities in the performing arts industry.',
              questions: ['Which audience would you like to focus on first?']
            },
            sources: ['Next API/README.md'],
            limited: true
          }),
          cancelDiscovery: async () => {}
        }}
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
export const emptyMedium = defineFixture({ width: 730, render: () => board(emptyPortfolio()) })
export const emptyNarrow = defineFixture({ width: 390, render: () => board(emptyPortfolio()) })
export const emptyWithRoles = defineFixture({
  width: 1100,
  render: () => board({ ...emptyPortfolio(), roles: state.roles })
})
export const noTasks = defineFixture({
  width: 1100,
  render: () => board({ ...state, tasks: [] })
})
export const noRoles = defineFixture({
  width: 1100,
  render: () => board({ ...state, tasks: [], roles: [] })
})
export const wide = defineFixture({ width: 1560, render: () => board(state) })
export const narrow = defineFixture({ width: 390, render: () => board(state) })
export const newProject = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'New initiative'
    )
    if (!button) {
      throw new Error('New project action missing')
    }
    button.click()
  }
})
export const editProject = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'Edit initiative'
    )
    if (!button) {
      throw new Error('Edit project action missing')
    }
    button.click()
  }
})
export const review = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: async (frame) => {
    const tasks = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'Tasks'
    )
    if (!tasks) {
      throw new Error('Tasks view missing')
    }
    tasks.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const button = [...frame.querySelectorAll('button')].find((entry) =>
      entry.textContent?.includes('Verify mobile sign in')
    )
    if (!button) {
      throw new Error('Review task missing')
    }
    button.click()
  }
})

export const ideaProject = defineFixture({
  width: 1100,
  render: () => board(emptyPortfolio()),
  interact: (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'Start with an idea'
    )
    if (!button) {
      throw new Error('Idea action missing')
    }
    button.click()
  }
})
export const discoveryDraft = defineFixture({
  width: 1200,
  render: () => board(state),
  interact: async (frame) => {
    const click = (label: string): void => {
      const button = [...document.querySelectorAll('button')].find(
        (entry) => entry.textContent === label
      )
      if (!button) {
        throw new Error(`Missing action: ${label}`)
      }
      button.click()
    }
    const button = [...frame.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'New initiative'
    )
    if (!button) {
      throw new Error('New project missing')
    }
    button.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const source = document.querySelector<HTMLButtonElement>('[role="checkbox"]')
    if (!source) {
      throw new Error('Project source missing')
    }
    source.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    click('Draft objective with AI')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const confirm = [...document.querySelectorAll('button')].find(
      (entry) => entry.textContent === 'Confirm and save'
    )
    confirm?.scrollIntoView({ block: 'end' })
  }
})

export const importAndAnalyze = defineFixture({
  width: 1200,
  render: () => board(emptyPortfolio(), true),
  interact: async (frame) => {
    const button = [...frame.querySelectorAll('button')].find((entry) =>
      entry.textContent?.includes('Import directory')
    )
    if (!button) {
      throw new Error('Import action missing')
    }
    button.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const picker = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')
    const browse = [...(picker?.querySelectorAll('button') ?? [])].find(
      (entry) => entry.textContent === 'Import directory'
    )
    if (!browse) {
      throw new Error('Directory browser missing')
    }
    browse.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
})

function mobileFeatureState() {
  const value = emptyPortfolio()
  value.projects.push({
    id: 'mobile',
    name: 'Ludus Mobile',
    objective:
      'Deliver reliable Android and iOS workflows with shared product context, acceptance criteria, and designs. Compare each platform against the same expected behavior. Related API development supports these mobile outcomes. Confirm the audience and priority workflows before implementation.',
    repoIds: ['api', 'mobile']
  })
  value.features.push({
    id: 'reports',
    projectId: 'mobile',
    name: 'Event reports',
    description: 'Keep sold and remaining counts consistent across iOS and Android.',
    versions: []
  })
  return value
}
async function openMobileFeature(frame: HTMLElement) {
  const button = [...frame.querySelectorAll('button')].find((entry) =>
    entry.textContent?.includes('Event reports')
  )
  if (!button) {
    throw new Error('Feature entry missing')
  }
  button.click()
  await new Promise((resolve) => requestAnimationFrame(resolve))
}
function checkColumns(frame: HTMLElement) {
  const navigation = frame.querySelector('aside')?.getBoundingClientRect()
  const content = frame.querySelector('main')?.getBoundingClientRect()
  if (
    !navigation ||
    !content ||
    content.left < navigation.right - 1 ||
    Math.abs(content.top - navigation.top) > 2
  ) {
    throw new Error('Wide project content must align beside its navigation.')
  }
}
export const mobileFeature = defineFixture({
  width: 1100,
  render: () => board(mobileFeatureState()),
  interact: async (frame) => {
    await openMobileFeature(frame)
    checkColumns(frame)
  }
})
export const mobileFeatureNarrow = defineFixture({
  width: 390,
  render: () => board(mobileFeatureState()),
  interact: openMobileFeature
})
export const pageScroll = defineFixture({
  width: 1100,
  render: () => board(mobileFeatureState(), false, true),
  interact: async (frame) => {
    await openMobileFeature(frame)
    checkColumns(frame)
    const context = frame.querySelector('main summary')
    if (!(context instanceof HTMLElement)) {
      throw new Error('Project context disclosure missing')
    }
    context.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const page = frame.querySelector('[data-slot="portfolio-page"]')
    const main = frame.querySelector('main')
    if (!(page instanceof HTMLElement) || !main) {
      throw new Error('Project page missing')
    }
    if (page.scrollHeight <= page.clientHeight || getComputedStyle(main).overflowY !== 'visible') {
      throw new Error(
        'Long content must scroll the whole page, without an inner project scrollbar.'
      )
    }
    page.scrollTop = page.scrollHeight
    if (
      page.scrollTop === 0 ||
      main.getBoundingClientRect().bottom > page.getBoundingClientRect().bottom + 2
    ) {
      throw new Error('The page must scroll all the way to the final feature action.')
    }
  }
})
