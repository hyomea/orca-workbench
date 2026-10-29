import { createContext } from 'react'

export type PortfolioDesignActions = {
  attach: (workItemId: string, file: File) => Promise<boolean>
  remove: (workItemId: string, attachmentId: string) => Promise<boolean>
  read: (attachmentId: string) => Promise<string>
}
export const PortfolioDesignContext = createContext<PortfolioDesignActions | null>(null)

export async function portfolioImageBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid image data.'))
        return
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}
