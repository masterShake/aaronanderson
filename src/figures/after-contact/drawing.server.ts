import 'server-only'
import type { DrawingBuilder } from '@/drawings/types'
import { docsBuilder, graphDoc } from '@/drawings/render'
import { afterContactGraphs, receivedGraph } from '@/drawings/graphs/after-contact'

/**
 * The after-contact drawing files served by /drawings/[file] (owner: contact):
 *   after-contact.{wide,tall}.json and .{family}.flow.still.svg  the four-node flow, CAD on deep
 *   after-contact.wide.received.still.svg                        the success drawing in the form
 */

const flow = docsBuilder(
  (family, rev) => graphDoc(afterContactGraphs[family], rev, family, { medium: 'cad' }),
  [{ rev: 'flow', ground: 'deep' }],
)

const received = docsBuilder(
  (family, rev) => graphDoc(receivedGraph, rev, family, { medium: 'cad' }),
  [{ rev: 'received', ground: 'deep' }],
  ['wide'],
)

const RECEIVED_FILE = 'wide.received.still.svg'

export const drawing: DrawingBuilder = {
  files: [...flow.files, RECEIVED_FILE],
  build(file) {
    return file === RECEIVED_FILE ? received.build(file) : flow.build(file)
  },
}
