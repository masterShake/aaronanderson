import { DRAWING_FILES, buildFile, contentType } from '@/drawings/files'

/**
 * Serves every non-hero drawing as a prerendered static file: layer bundles
 * ({figure}.{family}.json) and baked stills ({figure}.{family}[.{state}].still.svg).
 * Built once at build time (●); unknown names 404.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return DRAWING_FILES.map((file) => ({ file }))
}

export async function GET(_req: Request, ctx: RouteContext<'/drawings/[file]'>) {
  const { file } = await ctx.params
  return new Response(buildFile(file), { headers: { 'Content-Type': contentType(file) } })
}
