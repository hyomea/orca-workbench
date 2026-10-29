// @vitest-environment happy-dom
import { createBrowserUuid } from '@/lib/browser-uuid'
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyPortfolio } from '../../../../shared/portfolio'
import type { PortfolioDiscoveryResult } from '../../../../shared/portfolio-discovery'
import type { PortfolioSetupActions } from './portfolio-project-setup-types'
import { PortfolioProjectSetup } from './PortfolioProjectSetup'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string) => fallback
}))
afterEach(cleanup)

const result: PortfolioDiscoveryResult = {
  draft: {
    name: 'Arts hub',
    summary: 'An idea for exploring the arts.',
    objective: 'Explore possibilities for artists and audiences.',
    questions: ['Who is the first audience?']
  },
  sources: [],
  limited: false
}

function setup(
  discover: PortfolioSetupActions['discover'],
  imports: Partial<PortfolioSetupActions> = {},
  draftKey = createBrowserUuid(),
  initialize = true
) {
  const onClose = vi.fn()
  const onSave = vi.fn(async () => true)
  const cancelDiscovery = vi.fn(async () => {})
  const view = render(
    <PortfolioProjectSetup
      draftKey={draftKey}
      state={emptyPortfolio()}
      projectId=""
      editing={false}
      fromIdea
      repos={[]}
      actions={{
        discover,
        cancelDiscovery,
        pickSources: async () => [],
        importSource: async (source) => ({ id: source.path, name: source.name }),
        ...imports
      }}
      busy={false}
      saveError=""
      onSave={onSave}
      onClose={onClose}
    />
  )
  if (initialize) {
    fireEvent.change(screen.getByLabelText('Tell us what you have in mind'), {
      target: { value: '探索表演艺术行业的可能性' }
    })
  }
  return { ...view, onSave, onClose, cancelDiscovery, draftKey }
}

it('keeps AI drafts unsaved, allows corrections, and saves only the confirmed objective', async () => {
  const requests: Parameters<PortfolioSetupActions['discover']>[0][] = []
  const { onSave } = setup(async (request) => {
    requests.push(request)
    return result
  })
  await act(async () => {
    fireEvent.click(screen.getByText('Draft objective with AI'))
  })
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', result.draft.objective)
  fireEvent.change(screen.getByLabelText('Add context or correct the draft'), {
    target: { value: '先关注小型剧院' }
  })
  await act(async () => {
    fireEvent.click(screen.getByText('Refine with AI'))
  })
  expect(requests[1].notes).toContain('先关注小型剧院')
  expect(requests[1].previous?.objective).toBe(result.draft.objective)
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Objective'), {
    target: { value: 'Explore possibilities for small theatres.' }
  })
  await act(async () => {
    fireEvent.click(screen.getByText('Confirm and save'))
  })
  expect(onSave).toHaveBeenCalledWith({
    kind: 'project.create',
    project: {
      name: 'Arts hub',
      objective: 'Explore possibilities for small theatres.',
      repoIds: []
    }
  })
})

it('ignores a late AI response after Stop and keeps manual editing available', async () => {
  let finish!: (value: PortfolioDiscoveryResult) => void
  const pending = new Promise<PortfolioDiscoveryResult>((resolve) => {
    finish = resolve
  })
  const { onSave, cancelDiscovery } = setup(() => pending)
  fireEvent.click(screen.getByText('Draft objective with AI'))
  await act(async () => {
    fireEvent.click(screen.getByText('Stop'))
  })
  fireEvent.click(screen.getByText('Write manually'))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My idea' } })
  fireEvent.change(screen.getByLabelText('Objective'), {
    target: { value: 'A direction I chose.' }
  })
  await act(async () => {
    finish(result)
    await pending
  })
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'My idea')
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', 'A direction I chose.')
  expect(cancelDiscovery).toHaveBeenCalledOnce()
  expect(onSave).not.toHaveBeenCalled()
})

it('imports selected directories before analyzing once with the returned IDs and current notes', async () => {
  const discover = vi.fn(async () => result)
  let finishImport!: (value: { id: string; name: string }) => void
  const imported = new Promise<{ id: string; name: string }>((resolve) => {
    finishImport = resolve
  })
  const { onSave } = setup(discover, {
    pickSources: async () => [{ path: '/project/mobile', name: 'Mobile source', kind: 'git' }],
    importSource: () => imported
  })
  fireEvent.click(screen.getByText('Existing project'))
  await act(async () => {
    fireEvent.click(screen.getByText('Import directory'))
  })
  expect(screen.queryByText('Import selected')).toBeNull()
  expect(screen.queryByText('Draft objective with AI')).toBeNull()
  fireEvent.click(screen.getByText('Import and analyze'))
  expect(screen.getByText('Importing selected directories…')).toBeTruthy()
  expect(discover).not.toHaveBeenCalled()
  await act(async () => {
    finishImport({ id: 'mobile-id', name: 'Mobile source' })
    await imported
  })
  expect(discover).toHaveBeenCalledOnce()
  expect(discover).toHaveBeenCalledWith(
    expect.objectContaining({ repoIds: ['mobile-id'], notes: '探索表演艺术行业的可能性' })
  )
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', result.draft.objective)
  expect(onSave).not.toHaveBeenCalled()
})

it('stops on a partial import failure and retries only the remaining directory before analysis', async () => {
  const discover = vi.fn(async () => result)
  let failSecond = true
  const importedPaths: string[] = []
  setup(discover, {
    pickSources: async () => [
      { path: '/project/api', name: 'API source', kind: 'git' },
      { path: '/project/docs', name: 'Docs source', kind: 'folder' }
    ],
    importSource: async (source) => {
      importedPaths.push(source.path)
      if (source.name === 'Docs source' && failSecond) {
        throw new Error('Directory unavailable')
      }
      return { id: source.path, name: source.name }
    }
  })
  fireEvent.click(screen.getByText('Existing project'))
  await act(async () => {
    fireEvent.click(screen.getByText('Import directory'))
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /API source/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /Docs source/ }))
  await act(async () => {
    fireEvent.click(screen.getByText('Import and analyze'))
  })
  expect(screen.getByRole('alert').textContent).toBe('Directory unavailable')
  expect(discover).not.toHaveBeenCalled()
  failSecond = false
  await act(async () => {
    fireEvent.click(screen.getByText('Import and analyze'))
  })
  expect(importedPaths).toEqual(['/project/api', '/project/docs', '/project/docs'])
  expect(discover).toHaveBeenCalledOnce()
  expect(discover).toHaveBeenCalledWith(
    expect.objectContaining({ repoIds: ['/project/api', '/project/docs'] })
  )
})

it('keeps imported sources selected when analysis fails so retry does not import them again', async () => {
  const discover = vi
    .fn<PortfolioSetupActions['discover']>()
    .mockRejectedValueOnce(new Error('Agent unavailable'))
    .mockResolvedValue(result)
  const importSource = vi.fn(async () => ({ id: 'docs-id', name: 'Docs source' }))
  setup(discover, {
    pickSources: async () => [{ path: '/project/docs', name: 'Docs source', kind: 'folder' }],
    importSource
  })
  fireEvent.click(screen.getByText('Existing project'))
  await act(async () => {
    fireEvent.click(screen.getByText('Import directory'))
  })
  await act(async () => {
    fireEvent.click(screen.getByText('Import and analyze'))
  })
  expect(screen.getByRole('alert').textContent).toBe('Agent unavailable')
  await act(async () => {
    fireEvent.click(screen.getByText('Draft objective with AI'))
  })
  expect(importSource).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', result.draft.objective)
})

it('restores imported sources, analysis, corrections, and refinement after closing and reopening', async () => {
  const discover = vi.fn(async () => result)
  const first = setup(discover, {
    pickSources: async () => [{ path: '/arts', name: 'Arts folder', kind: 'folder' }],
    importSource: async () => ({ id: 'arts-id', name: 'Arts folder' })
  })
  fireEvent.click(screen.getByText('Existing project'))
  await act(async () => {
    fireEvent.click(screen.getByText('Import directory'))
  })
  await act(async () => {
    fireEvent.click(screen.getByText('Import and analyze'))
  })
  fireEvent.change(screen.getByLabelText('Objective'), {
    target: { value: 'My corrected objective' }
  })
  fireEvent.change(screen.getByLabelText('Add context or correct the draft'), {
    target: { value: 'Focus on theatre' }
  })
  fireEvent.click(screen.getByRole('button', { name: /^Close$/ }))
  expect(first.onClose).toHaveBeenCalledOnce()
  first.unmount()
  const reopened = setup(discover, {}, first.draftKey, false)
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', 'My corrected objective')
  expect(screen.getByLabelText('Tell us what you have in mind')).toHaveProperty(
    'value',
    '探索表演艺术行业的可能性'
  )
  expect(screen.getByLabelText('Add context or correct the draft')).toHaveProperty(
    'value',
    'Focus on theatre'
  )
  expect(screen.getByText(result.draft.summary)).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Arts folder' }).getAttribute('aria-checked')).toBe(
    'true'
  )
  expect(discover).toHaveBeenCalledOnce()
  expect(reopened.onSave).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(screen.getByText('Confirm and save'))
  })
  expect(reopened.onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      project: { name: 'Arts hub', objective: 'My corrected objective', repoIds: ['arts-id'] }
    })
  )
  reopened.unmount()
  setup(discover, {}, first.draftKey, false)
  expect(screen.queryByLabelText('Objective')).toBeNull()
  expect(screen.getByLabelText('Tell us what you have in mind')).toHaveProperty('value', '')
})

it('guards accidental dismissal during analysis without cancelling or losing the response', async () => {
  let finish!: (value: PortfolioDiscoveryResult) => void
  const pending = new Promise<PortfolioDiscoveryResult>((resolve) => {
    finish = resolve
  })
  const view = setup(() => pending)
  fireEvent.click(screen.getByText('Draft objective with AI'))
  fireEvent.click(screen.getByRole('button', { name: /^Close$/ }))
  expect(view.onClose).not.toHaveBeenCalled()
  expect(view.cancelDiscovery).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('Work is still running')
  await act(async () => {
    finish(result)
    await pending
  })
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', result.draft.objective)
  fireEvent.click(screen.getByText('Close and keep draft'))
  expect(view.onClose).toHaveBeenCalledOnce()
})

it('preserves a failed save and requires explicit confirmation to discard the restored draft', async () => {
  const first = setup(async () => result)
  await act(async () => {
    fireEvent.click(screen.getByText('Draft objective with AI'))
  })
  first.onSave.mockResolvedValue(false)
  await act(async () => {
    fireEvent.click(screen.getByText('Confirm and save'))
  })
  expect(first.onClose).not.toHaveBeenCalled()
  first.unmount()
  const reopened = setup(async () => result, {}, first.draftKey, false)
  fireEvent.click(screen.getByText('Discard draft'))
  expect(reopened.onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Objective')).toHaveProperty('value', result.draft.objective)
  fireEvent.click(screen.getByText('Keep editing'))
  fireEvent.click(screen.getByText('Discard draft'))
  fireEvent.click(screen.getByText('Confirm discard'))
  expect(reopened.onClose).toHaveBeenCalledOnce()
  reopened.unmount()
  setup(async () => result, {}, first.draftKey, false)
  expect(screen.queryByLabelText('Objective')).toBeNull()
})
