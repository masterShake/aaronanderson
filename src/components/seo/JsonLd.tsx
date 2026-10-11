/**
 * A JSON-LD <script>. Every '<' is escaped as <, so content can never
 * close the script tag. Callers pass only real facts (fact()), never HOLD text.
 */
export function JsonLd({ data, id }: { data: object; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
