import { useRef, useState } from 'react'
import type { PortfolioSourceSelection } from './portfolio-project-draft'
import type {
  PortfolioImportCandidate,
  PortfolioSetupActions
} from './portfolio-project-setup-types'

export function usePortfolioSourceImport({
  selected,
  onChange,
  actions,
  initial
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  actions: PortfolioSetupActions
  initial?: PortfolioSourceSelection
}) {
  const [candidates, setCandidates] = useState<PortfolioImportCandidate[]>(
    initial?.candidates ?? []
  )
  const [picked, setPicked] = useState<string[]>(initial?.picked ?? [])
  const [added, setAdded] = useState<{ id: string; name: string }[]>(initial?.added ?? [])
  const [phase, setPhase] = useState<'idle' | 'browsing' | 'importing'>('idle')
  const [error, setError] = useState('')
  const working = useRef(false)
  const pending = candidates.filter((entry) => picked.includes(entry.path))

  async function browse(): Promise<void> {
    if (working.current) {
      return
    }
    working.current = true
    setPhase('browsing')
    setError('')
    try {
      const next = await actions.pickSources()
      if (next.length > 0) {
        setCandidates(next)
        setPicked(next.length === 1 ? [next[0].path] : [])
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      working.current = false
      setPhase('idle')
    }
  }

  async function importSelected(): Promise<string[] | null> {
    if (working.current) {
      return null
    }
    working.current = true
    setPhase('importing')
    setError('')
    const next = new Set(selected)
    try {
      for (const source of pending) {
        const repo = await actions.importSource(source)
        setAdded((current) => [...current.filter((entry) => entry.id !== repo.id), repo])
        next.add(repo.id)
        onChange([...next])
        setCandidates((current) => current.filter((entry) => entry.path !== source.path))
        setPicked((current) => current.filter((path) => path !== source.path))
      }
      return [...next]
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      return null
    } finally {
      working.current = false
      setPhase('idle')
    }
  }

  return {
    candidates,
    picked,
    setPicked,
    added,
    phase,
    error,
    pendingCount: pending.length,
    browse,
    importSelected
  }
}
