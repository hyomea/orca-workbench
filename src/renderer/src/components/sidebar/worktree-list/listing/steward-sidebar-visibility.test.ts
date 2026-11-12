import { expect, it } from 'vitest'
import type { Repo } from '../../../../../../shared/repo-types'
import { visibleSidebarRepo } from './steward-sidebar-visibility'

const repo = (path: string, executionHostId: Repo['executionHostId'] = 'local'): Repo => ({
  id: 'repo',
  path,
  displayName: 'Project',
  badgeColor: '',
  addedAt: 0,
  kind: 'folder',
  executionHostId
})

it('keeps real projects while hiding only the local Steward folder', () => {
  const stewardPaths = new Set(['/profile/workbench/steward'])
  expect(visibleSidebarRepo(repo('/profile/workbench/steward'), stewardPaths)).toBe(false)
  expect(visibleSidebarRepo(repo('/projects/product'), stewardPaths)).toBe(true)
  expect(visibleSidebarRepo(repo('/profile/workbench/steward', 'ssh:remote'), stewardPaths)).toBe(
    true
  )
})
