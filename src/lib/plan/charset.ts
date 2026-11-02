/**
 * Every character the in-world labels may use. The self-hosted label font covers all of these;
 * any other character would make troika fetch a fallback font from a CDN at runtime, so a test
 * asserts every label stays inside this set.
 */
export const LABEL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.′″×½¼¾'

export const inCharset = (text: string): boolean => [...text].every((c) => LABEL_CHARSET.includes(c))
