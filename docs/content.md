# Editing the site's copy

Every word on the site lives in `src/content/`. Components and drawings hold no copy, so
you can change any sentence without touching code. After an edit, run
`npm run check:content` and `npm run punchlist`.

## Where each piece lives

| File                              | What it holds                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `site.ts`                         | Name, email, phone, location, call length, reply time, booking link, navigation, footer         |
| `seo.ts`                          | Page titles, search descriptions and share-card text                                            |
| `pages/home.ts`                   | Home, sheet G-01: hero, wiring, sheet index, process strip, crew, as-builts, closing            |
| `services.ts`                     | The six services, S-01 to S-06: promise, explanation, examples, what you receive, length, price |
| `pages/services.ts`               | Services page, sheet S-00: heading, schedule, "Not in contract." list, closing                  |
| `process.ts`                      | The five steps, P-01 to P-05                                                                    |
| `pages/how-it-works.ts`           | How it works, sheet P-00: ticket intro, the five plates, legend and FAQ headings                |
| `legend.ts`                       | Drawing symbols and the AI glossary (the `?` toggletips across the site read from here)         |
| `faq.ts`                          | The questions and answers on How it works                                                       |
| `people.ts`                       | The crew: names, roles, bios, photos, "Ask me about", LinkedIn                                  |
| `proof.ts`                        | Case studies, quotes, logos and stats (all on HOLD until real)                                  |
| `pages/about.ts`                  | About, sheet G-02: crew, strata, general notes, beliefs, org chart                              |
| `pages/contact.ts`                | Contact, sheet G-03: booking, form, errors, email, next steps, privacy                          |
| `pages/not-found.ts`              | The 404 sheet and the error page                                                                |
| `pages/preview.ts`                | Preview-only pages (`/punch-list`, `/kit`)                                                      |
| `figures/*.ts`                    | Every drawing's title, caption, labels, hand notes, buttons and screen-reader description       |
| `types.ts`, `hold.ts`, `index.ts` | The shapes and helpers. Don't edit these; ask for a change instead                              |

## Filling in a HOLD

A HOLD marks a fact only you can supply. In code it looks like this:

```ts
email: hold('Public email address', { id: 'site.email', kind: 'email', essential: true }),
```

To fill it, replace the whole `hold(…)` call with the real value:

```ts
email: 'hello@actualengineer.com',
```

- **Preview builds** show each open HOLD as a dashed chip or cloud, so nothing is hidden.
- **Production builds** show the HOLD's `prodFallback` instead, or leave the element out
  when there is none. Proof (case studies, quotes, logos) stays out of production until real.
- **Essential HOLDs** block launch: `STRICT_HOLDS=1 npm run build` fails while any remain.
  They are the email, the booking link, the call length, the S-01 and S-06 prices, and the
  crew names.

Some facts sit inside sentences. Write them so the sentence still reads:

| Fact                     | Sentence                                | Write it as                |
| ------------------------ | --------------------------------------- | -------------------------- |
| `site.callLength`        | "A {callLength} call with the people…"  | `'30-minute'`              |
| `site.replyTime`         | "We reply {replyTime}."                 | `'within one working day'` |
| `people.teamSize`        | "Actual Engineer is {teamSize} people." | `'three'`                  |
| `hours.s06`              | "{hours} hours each month"              | `'Eight'`                  |
| `price.s01`, `price.s06` | "Fixed fee, starting at {price}"        | the price with currency    |

## Confirming a promise

A CONFIRM marks a promise the site makes only once you agree to it:

```ts
confirm("We don't rip out systems that work.", { id: 'nic.ripOut' })
```

- `status: 'pending'` (the default) shows in previews with a CONFIRM mark and is left out of
  production.
- Add `status: 'ok'` to keep it everywhere, or `status: 'cut'` to drop it.
- You can also reword the promise before you confirm it.

Pending promises include the "Not in contract." list, the five plates (GUARD, INTERLOCK,
LOGBOOK, OFF SWITCH, INSPECTION), the About general notes and beliefs line, the Home process
line, the S-03 "It doesn't sign, pay or send anything…" line, the FAQ answers that promise
something, and the privacy line.

## The punch list

```sh
npm run punchlist            # every open HOLD and pending CONFIRM, with file and line
npm run punchlist -- --json  # the same, for tools
npm run punchlist -- --write # regenerates PLACEHOLDERS.md, with the deployment settings
```

Previews also show the same list at `/punch-list`.

## Writing rules

`npm run check:content` enforces these; the build runs it too.

- **US English:** color, labeled, aluminum, center, gray.
- **Short and plain:** one sub-head per section, bullets over paragraphs. Service
  explanations stay two short sentences.
- **Plain words before symbols:** "Sign-off valve (HV)", not "HV".
- **No digits in prose.** Write durations in words ("two to six weeks"). Digits are allowed
  only in facts (prices, call length, dates), HOLD notes, `{vars}` and a few patterns such
  as sheet numbers (S-01), REV 1, 1:1, 90-day and `Estimate_FINAL_v7.xlsx`.
- **No counts typed by hand.** Drawing counts ("ten tools, twelve hand-offs") come from the
  drawing data through `{vars}`, so the copy can never disagree with the picture.
- **No banned words** (seamless, leverage, unlock, cutting-edge and the rest in
  `scripts/check-content.mjs`).
- **No repeated sentences** of five words or more anywhere in the content.
- **Hand notes** (the handwriting in drawings): sentence case, each one unique, at most six
  per figure and twelve on the whole site. Today: hero 4, Home wiring 2 (one is
  `pages/home.ts` `wiring.newNote`), S-01 2, ticket 2, org chart 1, 404 1.
- **Never invent** clients, quotes, numbers, logos, partnerships or stats. Use a HOLD.
- **Examples are labeled:** company drawings carry "EXAMPLE FIRM — NOT A CLIENT"
  (`site.exampleTag`) and demo data carries SAMPLE (`site.sampleTag`).
- **Brand names** appear only in S-02's "such as Procore, QuickBooks or Sage".

## Rich text

Fields typed `Rich` accept two kinds of token:

- `[[api]]` or `[[api|the API]]` opens the glossary entry for a term in `legend.ts`.
- `{name}` fills a value. `{callLength}`, `{replyTime}` and `{teamSize}` fill from the site
  facts; other names are filled by the page or drawing. `{name:word}` spells zero to twelve
  as a word.

In production, a sentence whose fact is an unfilled HOLD with no fallback is left out whole.
