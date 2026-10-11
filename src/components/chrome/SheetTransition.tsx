import { ViewTransition, type ReactNode } from 'react'

/**
 * The page-level view transition: the new sheet prints left to right (forward)
 * or right to left (back). The header is never named, so it stays clickable.
 */
export function SheetTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'sheet-forward': 'sheet-print', 'sheet-back': 'sheet-print-back', default: 'none' }}
      exit={{ 'sheet-forward': 'sheet-out', 'sheet-back': 'sheet-out', default: 'none' }}
      default="none"
    >
      <div className="sheet">{children}</div>
    </ViewTransition>
  )
}
