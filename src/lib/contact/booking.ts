import { asSheet } from './fields'

/**
 * Cal.com booking notes from the page's ?sheet (code-platform-10): "About S-03 · AI Workflow
 * Automation" when ?sheet names a known sheet, otherwise null (no notes). The facade calls it
 * at click time with window.location.search, so /contact stays static. Cal.com prefills a
 * booking field from the embed config key of the same name: `notes` is its "Additional notes".
 */
export function bookingNotes(
  search: string,
  sheets: Readonly<Record<string, string>>,
  template: string,
): string | null {
  const id = asSheet(new URLSearchParams(search).get('sheet'))
  const name = id ? sheets[id] : undefined
  if (!id || !name) return null
  return template.replace('{sheet}', id).replace('{serviceName}', name)
}
