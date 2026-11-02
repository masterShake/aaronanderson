/**
 * Shader patching by anchor string, shared by every patched three material. Each anchor must occur
 * exactly once in the source being patched: three is pinned (save-exact), and after an upgrade a
 * moved or duplicated anchor throws (in the material tests and at construction) instead of silently
 * mis-patching.
 */
export function inject(src: string, at: string, code: string, replace = false): string {
  if (src.split(at).length !== 2) throw new Error(`inject: anchor not found exactly once: ${at}`)
  // A replacer function, so `$&`-style patterns in GLSL are never expanded.
  return src.replace(at, () => (replace ? code : `${at}\n${code}`))
}
