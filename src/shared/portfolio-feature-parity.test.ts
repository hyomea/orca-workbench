import { expect, it } from 'vitest'
import { applyPortfolioCommand, emptyPortfolio, PortfolioCommand } from './portfolio'

const checked = { status: 'same', note: '', evidence: 'Staging, build 15', checkedOn: '2026-11-03' }

it('records a feature’s parity and refuses unexplained or unevidenced checks', () => {
  const state = emptyPortfolio()
  state.projects.push({ id: 'p', name: 'Mobile', objective: 'Parity', repoIds: [] })
  applyPortfolioCommand(
    state,
    { kind: 'feature.create', feature: { projectId: 'p', name: 'Check-in', description: '' } },
    'f',
    1
  )
  const parity = {
    ios: checked,
    android: { status: 'unknown', note: 'Needs a Bluetooth scanner', evidence: '' },
    ruleLocation: 'API: /check-ins',
    needsHardware: true
  }
  applyPortfolioCommand(
    state,
    PortfolioCommand.parse({ kind: 'feature.parity', featureId: 'f', parity }),
    'unused',
    2
  )
  expect(state.features[0].parity).toEqual(parity)
  for (const android of [
    { status: 'unknown', note: '', evidence: '' },
    { status: 'differs', note: 'Shows a different total', evidence: '' },
    { status: 'same', note: '', evidence: 'Looked at it' }
  ]) {
    expect(
      PortfolioCommand.safeParse({
        kind: 'feature.parity',
        featureId: 'f',
        parity: { ...parity, android }
      }).success
    ).toBe(false)
  }
})
