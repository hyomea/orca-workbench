import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  parsePortfolioState,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState,
  type PortfolioTask
} from './portfolio'
import {
  portfolioAcceptBlocker,
  portfolioStageBlocker,
  portfolioTrackTask,
  type PortfolioTaskStage
} from './portfolio-task-stages'

function apply(state: PortfolioState, command: unknown, id = 'change', now = 1): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, now)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    {
      kind: 'project.create',
      project: { name: 'Mobile', objective: 'Ship', repoIds: ['android'] }
    },
    'project'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' } },
    'role'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'engineering',
        title: 'Test foundation',
        description: 'Unit tests on Android',
        acceptanceCriteria: 'Tests run on PRs',
        designReferences: '',
        tickets: [{ platform: 'android', reference: 'ENG-1' }],
        parity: false
      }
    },
    'outcome'
  )
  for (const stage of ['development', 'codeReview', 'qa'] as const) {
    apply(
      state,
      {
        kind: 'task.create',
        task: {
          projectId: 'project',
          workItemId: 'outcome',
          roleId: 'role',
          platform: 'android',
          stage,
          title: stage,
          instructions: `Do ${stage}`,
          acceptanceCriteria: 'Done'
        }
      },
      stage
    )
  }
  return state
}

function task(state: PortfolioState, id: PortfolioTaskStage): PortfolioTask {
  return state.tasks.find((entry) => entry.id === id)!
}

function launch(state: PortfolioState, id: string, worktree = 'branch'): string {
  const attempt = preparePortfolioAttempt(state, id, worktree, 'android', `${id}-op`, 2)
  attempt.state = 'launched'
  return attempt.prompt
}

function submit(state: PortfolioState, id: string): void {
  apply(state, {
    kind: 'task.transition',
    taskId: id,
    status: 'review',
    note: `${id} result`,
    commit: 'abc1234'
  })
}

function accept(state: PortfolioState, id: string): void {
  apply(state, {
    kind: 'task.transition',
    taskId: id,
    status: 'accepted',
    note: 'OK',
    codeReview: 'reviewed'
  })
}

it('reads tasks saved before stages as development tasks without steps', () => {
  const state = fixture()
  const legacy = JSON.parse(JSON.stringify(state))
  for (const entry of legacy.tasks) {
    delete entry.stage
    delete entry.steps
  }
  expect(parsePortfolioState(legacy).tasks[0]).toMatchObject({
    stage: 'development',
    steps: []
  })
})

it('keeps one task per stage for each outcome and platform', () => {
  const state = fixture()
  expect(() =>
    apply(state, {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'outcome',
        roleId: 'role',
        platform: 'android',
        title: 'Second review',
        instructions: 'Review',
        acceptanceCriteria: 'Done',
        stage: 'codeReview'
      }
    })
  ).toThrow('already has a code review task')
  expect(() =>
    apply(state, {
      kind: 'task.create',
      task: {
        projectId: 'project',
        roleId: 'role',
        title: 'Loose review',
        instructions: 'Review',
        acceptanceCriteria: 'Done',
        stage: 'qa'
      }
    })
  ).toThrow('belong to an outcome')
})

it('runs code review and QA in order on the development branch', () => {
  const state = fixture()
  expect(() => launch(state, 'codeReview')).toThrow('after development submits')
  expect(portfolioStageBlocker(state, task(state, 'codeReview'))).toBe(
    'Start this after development submits its work.'
  )
  launch(state, 'development')
  // A submission without a commit (as before submissions recorded one) cannot be reviewed.
  apply(state, { kind: 'task.transition', taskId: 'development', status: 'review', note: 'Built' })
  expect(() => launch(state, 'codeReview')).toThrow('Development has no submitted commit')
  apply(state, { kind: 'task.transition', taskId: 'development', status: 'blocked', note: 'Fix' })
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'review',
    note: 'Built',
    commit: 'abc1234'
  })
  expect(() => launch(state, 'qa')).toThrow('after you accept the code review')
  // The development session is still open in the same workspace; review only reads it.
  const prompt = launch(state, 'codeReview')
  expect(prompt).toContain('Stage: code review')
  expect(prompt).toContain('Development task: development (submitted at commit abc1234)')
  submit(state, 'codeReview')
  expect(() => accept(state, 'development')).toThrow('Accept the code review before')
  expect(portfolioAcceptBlocker(state, task(state, 'development'))).toBe(
    'Accept the code review before accepting development.'
  )
  // Accepting a review records the user's decision on its findings, not their own code review.
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'OK' })
  expect(task(state, 'codeReview').history.at(-1)).not.toHaveProperty('codeReview')
  launch(state, 'qa')
  submit(state, 'qa')
  accept(state, 'qa')
  accept(state, 'development')
  expect(task(state, 'development').status).toBe('accepted')
})

it('lets QA test the commit an accepted code review recorded', () => {
  const state = fixture()
  // Development submitted before submissions recorded a commit; the reviewer's submission did.
  launch(state, 'development')
  apply(state, { kind: 'task.transition', taskId: 'development', status: 'review', note: 'Built' })
  state.tasks
    .find((entry) => entry.id === 'codeReview')!
    .history.push({
      id: 'codeReview:legacy',
      at: 1,
      status: 'review',
      note: 'Pass',
      commit: 'def5678'
    })
  task(state, 'codeReview').status = 'review'
  expect(portfolioStageBlocker(state, task(state, 'qa'))).toBe(
    'Start QA after you accept the code review.'
  )
  apply(state, { kind: 'task.transition', taskId: 'codeReview', status: 'accepted', note: 'OK' })
  expect(launch(state, 'qa')).toContain('(submitted at commit def5678)')
})

it('keeps QA blocked when neither development nor the code review recorded a commit', () => {
  const state = fixture()
  launch(state, 'development')
  apply(state, { kind: 'task.transition', taskId: 'development', status: 'review', note: 'Built' })
  apply(state, { kind: 'task.delete', taskId: 'codeReview' })
  expect(portfolioStageBlocker(state, task(state, 'qa'))).toBe(
    'Development has no submitted commit. Ask the development agent to commit and submit.'
  )
})

it('keeps two development sessions out of one workspace', () => {
  const state = fixture()
  apply(state, {
    kind: 'task.create',
    task: {
      projectId: 'project',
      roleId: 'role',
      title: 'Other work',
      instructions: 'Build',
      acceptanceCriteria: 'Done'
    }
  })
  launch(state, 'development')
  expect(() => launch(state, 'change')).toThrow('Another development task is running')
  expect(launch(state, 'change', 'elsewhere')).toContain('Task: Other work')
})

it('returns findings to a live development session and resets later stages', () => {
  const state = fixture()
  launch(state, 'development')
  submit(state, 'development')
  launch(state, 'codeReview')
  submit(state, 'codeReview')
  expect(() => apply(state, { kind: 'task.sendBack', taskId: 'development', note: 'No' })).toThrow(
    'from a submitted code review or QA task'
  )
  apply(state, { kind: 'task.sendBack', taskId: 'codeReview', note: 'B-1: missing test' })
  const review = task(state, 'codeReview')
  expect(review).toMatchObject({ status: 'todo', evidence: '' })
  // The reviewer's session stays open to check the next submission against its findings.
  expect(review.attempts.at(-1)?.state).toBe('launched')
  const development = task(state, 'development')
  expect(development.status).toBe('running')
  expect(development.history.at(-1)).toMatchObject({
    returnedFrom: 'codeReview',
    note: 'Returned from code review: B-1: missing test'
  })
  const again = { kind: 'task.runAgain', taskId: 'codeReview' }
  expect(() => apply(state, again)).toThrow('after development submits')
  apply(state, {
    kind: 'task.transition',
    taskId: 'development',
    status: 'review',
    note: 'Fixed B-1',
    commit: 'def5678'
  })
  expect(() => launch(state, 'codeReview')).toThrow('Stop and close the previous execution')
  apply(state, again)
  expect(review).toMatchObject({ status: 'running' })
  expect(review.attempts).toHaveLength(1)
  expect(review.history.at(-1)?.note).toBe('Running again in the same session on def5678')
  expect(() => apply(state, again)).toThrow('after development submits again')
})

it('starts a fresh code review session once the open one is ended', () => {
  const state = fixture()
  launch(state, 'development')
  submit(state, 'development')
  launch(state, 'codeReview')
  submit(state, 'codeReview')
  apply(state, { kind: 'task.sendBack', taskId: 'codeReview', note: 'B-1: missing test' })
  submit(state, 'development')
  apply(state, { kind: 'task.closeExecution', taskId: 'codeReview', note: 'Fresh eyes' })
  expect(() => apply(state, { kind: 'task.runAgain', taskId: 'codeReview' })).toThrow(
    'no open session'
  )
  launch(state, 'codeReview')
  expect(task(state, 'codeReview').attempts).toHaveLength(2)
})

it('gives returned findings to the next development launch when the session was closed', () => {
  const state = fixture()
  launch(state, 'development')
  submit(state, 'development')
  apply(state, { kind: 'task.closeExecution', taskId: 'development', note: 'Closed it' })
  // Closing the run keeps the task in review; the submitted commit still counts.
  expect(task(state, 'development').history.at(-1)).toMatchObject({ status: 'review' })
  launch(state, 'codeReview')
  submit(state, 'codeReview')
  accept(state, 'codeReview')
  launch(state, 'qa')
  submit(state, 'qa')
  apply(state, { kind: 'task.sendBack', taskId: 'qa', note: 'Crash on rotate' })
  expect(task(state, 'development').status).toBe('todo')
  expect(task(state, 'codeReview')).toMatchObject({ status: 'todo' })
  expect(launch(state, 'development', 'branch')).toContain(
    'Address these findings first:\nReturned from QA: Crash on rotate'
  )
  submit(state, 'development')
  // A fresh review session, once the earlier one ends, is not given QA's findings.
  apply(state, { kind: 'task.closeExecution', taskId: 'codeReview', note: 'Closed it' })
  expect(launch(state, 'codeReview')).not.toContain('Crash on rotate')
})

function acceptAll(state: PortfolioState): void {
  launch(state, 'development')
  submit(state, 'development')
  for (const stage of ['codeReview', 'qa'] as const) {
    launch(state, stage)
    submit(state, stage)
    accept(state, stage)
  }
  accept(state, 'development')
}

it('records the user’s push confirmation on a submitted development session only', () => {
  const state = fixture()
  const confirm = { kind: 'task.confirmPush', taskId: 'development' }
  const prompt = launch(state, 'development')
  expect(prompt).toContain('Do not push or open a PR on your own.')
  expect(() => apply(state, confirm)).toThrow('has submitted its work')
  submit(state, 'development')
  apply(state, confirm)
  expect(task(state, 'development').history.at(-1)).toMatchObject({
    status: 'review',
    note: 'User confirmed: push the branch to its draft PR'
  })
  // Not a new submission: code review still reviews the submitted commit.
  expect(launch(state, 'codeReview')).toContain('Do not push, or open, comment on, or mark ready')
  expect(() => apply(state, { ...confirm, taskId: 'codeReview' })).toThrow('development task')
  apply(state, { kind: 'task.closeExecution', taskId: 'development', note: 'Done' })
  expect(() => apply(state, confirm)).toThrow('session is closed')
})

it('asks code review to triage new PR comments in a team initiative', () => {
  const state = fixture()
  acceptAll(state)
  const triage = { kind: 'task.requestTriage', taskId: 'codeReview', note: 'Two new comments' }
  expect(() => apply(state, triage)).toThrow('Only a team initiative')
  apply(state, { kind: 'project.reviewMode', projectId: 'project', mode: 'team' })
  expect(() => apply(state, { ...triage, taskId: 'development' })).toThrow(
    'submitted code review or QA task'
  )
  apply(state, triage)
  // The review session is still open, so it is working again; development cannot be accepted
  // until the user accepts the review again.
  expect(task(state, 'codeReview')).toMatchObject({ status: 'running', evidence: '' })
  expect(task(state, 'codeReview').history.at(-1)).toMatchObject({
    returnedFrom: 'pr',
    note: 'Returned from PR review: Two new comments'
  })
  expect(task(state, 'development').status).toBe('accepted')
  expect(task(state, 'qa').status).toBe('accepted')
})

it('tells team-mode agents to triage PR comments and the outcome’s external QA feedback', () => {
  const state = fixture()
  apply(state, { kind: 'project.reviewMode', projectId: 'project', mode: 'team' })
  launch(state, 'development')
  submit(state, 'development')
  expect(launch(state, 'codeReview')).toContain('Read its comments with `gh` (read only')
  submit(state, 'codeReview')
  accept(state, 'codeReview')
  expect(launch(state, 'qa')).toContain('this outcome has no QA feedback link yet')
  apply(state, {
    kind: 'workItem.scope',
    workItemId: 'outcome',
    tickets: [{ platform: 'android', reference: 'ENG-1' }],
    parity: false,
    qaFeedbackUrl: 'https://www.notion.so/qa-eng-1'
  })
  submit(state, 'qa')
  apply(state, { kind: 'task.closeExecution', taskId: 'qa', note: 'Closed it' })
  apply(state, { kind: 'task.requestTriage', taskId: 'qa', note: 'New QA round posted' })
  expect(task(state, 'qa').status).toBe('todo')
  const prompt = launch(state, 'qa')
  expect(prompt).toContain('records feedback at https://www.notion.so/qa-eng-1')
  expect(prompt).toContain(
    'Triage this new feedback first:\nReturned from external QA: New QA round posted'
  )
})

it('tracks development steps and keeps progress when the plan changes', () => {
  const state = fixture()
  apply(state, {
    kind: 'task.steps',
    taskId: 'development',
    steps: [
      { id: 'S1', title: 'Data layer' },
      { id: 'S2', title: 'UI' }
    ]
  })
  apply(state, {
    kind: 'task.step',
    taskId: 'development',
    stepId: 'S1',
    done: true,
    commit: 'abc1234'
  })
  apply(state, {
    kind: 'task.steps',
    taskId: 'development',
    steps: [
      { id: 'S1', title: 'Data layer' },
      { id: 'S2', title: 'Business logic' },
      { id: 'S3', title: 'UI' }
    ]
  })
  expect(task(state, 'development').steps).toEqual([
    { id: 'S1', title: 'Data layer', done: true, commit: 'abc1234' },
    { id: 'S2', title: 'Business logic', done: false },
    { id: 'S3', title: 'UI', done: false }
  ])
  expect(launch(state, 'development')).toContain('- [x] S1: Data layer\n- [ ] S2: Business logic')
  apply(state, { kind: 'task.step', taskId: 'development', stepId: 'S1', done: false })
  expect(task(state, 'development').steps[0]).toEqual({
    id: 'S1',
    title: 'Data layer',
    done: false
  })
  expect(() => apply(state, { kind: 'task.steps', taskId: 'codeReview', steps: [] })).toThrow(
    'Only development tasks have steps'
  )
})

it('edits and deletes only tasks that are not running', () => {
  const state = fixture()
  const details = {
    roleId: 'role',
    title: 'Review the branch',
    instructions: 'Review',
    acceptanceCriteria: 'Findings listed',
    stage: 'codeReview'
  }
  apply(state, { kind: 'task.update', taskId: 'codeReview', task: details })
  // Leaving out the platform moves it to the outcome's shared track.
  expect(task(state, 'codeReview').platform).toBeUndefined()
  expect(portfolioTrackTask(state, task(state, 'development'), 'codeReview')).toBeUndefined()
  expect(() =>
    apply(state, {
      kind: 'task.update',
      taskId: 'qa',
      task: { ...details, platform: 'android', stage: 'development' }
    })
  ).toThrow('already has a development task')
  launch(state, 'development')
  expect(() => apply(state, { kind: 'task.delete', taskId: 'development' })).toThrow(
    'not running can be deleted'
  )
  apply(state, { kind: 'task.delete', taskId: 'qa' })
  expect(state.tasks.map((entry) => entry.id)).toEqual(['development', 'codeReview'])
})
