import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export function PortfolioField({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export function PortfolioSelect({
  label,
  value,
  onChange,
  options,
  disabled
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { id: string; name: string }[]
  disabled?: boolean
}): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
