/**
 * The hero's tool and instrument decor lives in the runtime kit (src/stage/runtime/kit/decor.ts),
 * so the 3D scene chunk stays small and S-06 can draw the same glyphs. Re-exported here for the
 * build-time drawing (src/figures/hero/doc.server.ts).
 */
export * from '@/stage/runtime/kit/decor'
