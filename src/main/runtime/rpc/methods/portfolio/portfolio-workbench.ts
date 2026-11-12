import { BrowserWindow, dialog } from 'electron'
import { getAppEnvironment } from '../../../../../shared/app-environment'
import {
  PortfolioCreateWorkbench,
  PortfolioExportWorkbench,
  PortfolioImportWorkbench,
  PortfolioRemoveWorkbench,
  PortfolioWorkbenches
} from '../../../../../shared/rpc-contract/portfolio-params'
import {
  createWorkbench,
  listWorkbenches,
  removeWorkbench
} from '../../../../portfolio/workbench-spaces'
import {
  exportWorkbenchArchive,
  importWorkbenchArchive
} from '../../../../portfolio/workbench-transfer'
import { defineMethod } from '../../core'

function userData(): string {
  return getAppEnvironment().getPath('userData')
}

export const PORTFOLIO_WORKBENCH_METHODS = [
  defineMethod({
    name: 'portfolio.workbenches',
    permission: 'workspace',
    params: PortfolioWorkbenches,
    handler: () => listWorkbenches(userData())
  }),
  defineMethod({
    name: 'portfolio.createWorkbench',
    permission: 'workspace',
    params: PortfolioCreateWorkbench,
    handler: (params) => createWorkbench(userData(), params.name)
  }),
  defineMethod({
    name: 'portfolio.removeWorkbench',
    permission: 'workspace',
    params: PortfolioRemoveWorkbench,
    handler: (params) => removeWorkbench(userData(), params.workbenchId)
  }),
  defineMethod({
    name: 'portfolio.exportWorkbench',
    permission: 'workspace',
    params: PortfolioExportWorkbench,
    handler: async (params) => {
      const workbench = (await listWorkbenches(userData())).find(
        (entry) => entry.id === params.workbenchId
      )
      if (!workbench) {
        throw new Error('Workbench no longer exists. Refresh the list and try again.')
      }
      const parent = BrowserWindow.getFocusedWindow()
      const safeName =
        Array.from(workbench.name, (char) =>
          char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char
        )
          .join('')
          .replace(/[/\\:*?"<>|]/g, '_')
          .replace(/[. ]+$/g, '')
          .slice(0, 100) || 'workbench'
      const options = {
        defaultPath: `Orca-${safeName}.orca-workbench.zip`,
        filters: [{ name: 'Orca Workbench', extensions: ['zip'] }]
      }
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) {
        return null
      }
      await exportWorkbenchArchive(userData(), params.workbenchId, result.filePath)
      return result.filePath
    }
  }),
  defineMethod({
    name: 'portfolio.importWorkbench',
    permission: 'workspace',
    params: PortfolioImportWorkbench,
    handler: async () => {
      const parent = BrowserWindow.getFocusedWindow()
      const options = {
        properties: ['openFile'],
        filters: [{ name: 'Orca Workbench', extensions: ['zip'] }]
      } satisfies Electron.OpenDialogOptions
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths[0]) {
        return null
      }
      return importWorkbenchArchive(userData(), result.filePaths[0])
    }
  })
]
