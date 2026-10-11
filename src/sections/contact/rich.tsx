import type { ReactNode } from 'react'
import type { Rich } from '@/content/types'
import { RichText } from '@/components/ui/RichText'

/**
 * Helpers for passing Rich copy to the contact client components (C3): they
 * cannot import RichText, so the server renders it and hands over nodes.
 */

/** The raw text of a Rich value (no vars to fill), for status lines and attributes. */
export const plain = (r: Rich): string => (typeof r === 'string' ? r : r.text)

/**
 * Splits a Rich template at a render-time var the client fills (the visitor's
 * {name}): the parts before and after render on the server, so site HOLD
 * vars such as {replyTime} still resolve through RichText.
 */
export function splitRich(r: Rich, name: string): [ReactNode, ReactNode] {
  const text = plain(r)
  const vars = typeof r === 'string' ? {} : r.vars
  const at = text.indexOf(`{${name}}`)
  const before = at < 0 ? text : text.slice(0, at)
  const after = at < 0 ? '' : text.slice(at + name.length + 2)
  const part = (t: string) => (t ? <RichText value={{ text: t, vars }} as="span" /> : null)
  return [part(before), part(after)]
}
