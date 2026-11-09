import { useAppStore } from '@/store'
import { useNow } from '@/hooks/use-now'
import type { PortfolioState } from '../../../../shared/portfolio'
import { portfolioTracks, type PortfolioTrack } from './portfolio-tracks'
import { usePortfolioPrLookup, usePortfolioPrRefresh } from './portfolio-track-pr'

// The initiative's tracks as the Tasks page shows them, with live agent activity and PRs.
export function usePortfolioTracks(
  state: PortfolioState | null | undefined,
  projectId: string | undefined
): PortfolioTrack[] {
  const activity = useAppStore((s) => s.agentStatusByPaneKey)
  // A launch that stays silent past its grace period moves to "Needs attention" without new data.
  const now = useNow(30_000)
  const prFor = usePortfolioPrLookup()
  const tracks = state ? portfolioTracks(state, projectId, activity, now, prFor) : []
  usePortfolioPrRefresh(tracks.flatMap((track) => (track.pr ? [track.pr.worktreeId] : [])))
  return tracks
}
