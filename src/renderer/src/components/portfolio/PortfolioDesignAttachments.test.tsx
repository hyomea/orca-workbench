// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PortfolioDesignAttachments } from './PortfolioDesignAttachments'
import { PortfolioDesignContext } from './portfolio-design-actions'
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
afterEach(cleanup)

it('keeps a failed upload retryable and previews and removes only the selected attachment', async () => {
  const attachment = {
    id: 'a'.repeat(64),
    name: 'Report.png',
    mimeType: 'image/png' as const,
    bytes: 12
  }
  const actions = {
    attach: vi.fn(async () => false),
    remove: vi.fn(async () => true),
    read: vi.fn(async () => 'data:image/png;base64,AA==')
  }
  render(
    <PortfolioDesignContext value={actions}>
      <PortfolioDesignAttachments attachments={[attachment]} workItemId="item" editable />
    </PortfolioDesignContext>
  )
  const input = screen.getByLabelText('Choose design image')
  const file = new File(['image'], 'new.png', { type: 'image/png' })
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
  expect(actions.attach).toHaveBeenCalledWith('item', file)
  expect(screen.getByRole('alert').textContent).toContain('not saved')
  expect(screen.getByRole('button', { name: 'Attach screenshot' })).toHaveProperty(
    'disabled',
    false
  )
  actions.attach.mockResolvedValue(true)
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
  expect(screen.queryByRole('alert')).toBeNull()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'View image' }))
  })
  expect(actions.read).toHaveBeenCalledWith(attachment.id)
  expect(screen.getByAltText('Report.png')).toHaveProperty('src', 'data:image/png;base64,AA==')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  })
  expect(actions.remove).toHaveBeenCalledWith('item', attachment.id)
})
