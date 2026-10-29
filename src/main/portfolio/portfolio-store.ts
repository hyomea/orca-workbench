import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { lock } from 'proper-lockfile'
import { PortfolioState, emptyPortfolio } from '../../shared/portfolio'
import { writePluginFileAtomically } from '../plugins/installation/plugin-atomic-file-write'

export class PortfolioStore {
  constructor(readonly file: string) {}

  async read(): Promise<PortfolioState> {
    try {
      return PortfolioState.parse(JSON.parse(await readFile(this.file, 'utf8')))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return emptyPortfolio()
      }
      throw new Error('Cannot read project data. The existing file has been preserved.', {
        cause: error
      })
    }
  }

  async update(
    revision: number | null,
    change: (state: PortfolioState) => void
  ): Promise<PortfolioState> {
    await mkdir(dirname(this.file), { recursive: true })
    const release = await lock(this.file, {
      realpath: false,
      retries: { retries: 10, minTimeout: 20, maxTimeout: 200 }
    })
    try {
      const state = await this.read()
      if (revision !== null && state.revision !== revision) {
        throw new Error('Project data changed in another window. Refresh and try again.')
      }
      change(state)
      state.revision += 1
      const validated = PortfolioState.parse(state)
      await writePluginFileAtomically(this.file, JSON.stringify(validated, null, 2), {
        mode: 0o600
      })
      return validated
    } finally {
      await release()
    }
  }
}
