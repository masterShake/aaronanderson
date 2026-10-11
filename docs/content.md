# Content

_Skeleton from W0; the copy lane completes it._

- Every visible string lives in `src/content/**`. Components never contain copy.
- `hold(note, { id, kind, essential?, prodFallback? })` marks a fact still to come. Previews
  show a HOLD chip; production shows `prodFallback`, or nothing.
- `confirm(value, { id, status })` marks a promise. `pending` shows in previews with a
  CONFIRM mark and is left out of production; `ok` shows everywhere; `cut` never shows.
- Rich text: `[[api]]` or `[[api|the API]]` opens a glossary toggletip; `{callLength}`,
  `{replyTime}` and `{teamSize}` fill from the site facts; other `{vars}` come from the page.
- Rules (`npm run check:content`): no banned words, digits only in fact fields, hold notes,
  vars and a short pattern list (write durations in words), no repeated sentence of five or
  more words, at most 6 hand notes per figure and 12 on the site, US spelling.
