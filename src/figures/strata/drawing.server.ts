import 'server-only'
import { docsBuilder } from '@/drawings/render'
import { STRATA_REV, strataDoc } from '@/drawings/views/strata'

/** The strata drawing files served by /drawings/[file] (owner: home-about): one static state. */
export const drawing = docsBuilder(
  (family) => strataDoc(family),
  [{ rev: STRATA_REV, ground: 'paper' }],
)
