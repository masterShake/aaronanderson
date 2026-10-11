import type { ErrorContent, NotFoundContent } from '../types'

/** The 404 sheet. */
export const notFound: NotFoundContent = {
  h1: 'Sheet not found.',
  body: "This sheet isn't in the set.",
  links: 'The full set',
}

/** app/error.tsx and app/global-error.tsx. */
export const errorPage: ErrorContent = {
  h1: 'This sheet tore.',
  body: 'Something broke while drawing this page. Try again, or pick another sheet.',
  retry: 'Try again',
  links: 'Other sheets',
}
