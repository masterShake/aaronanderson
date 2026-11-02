/**
 * The five chapters of the story, in scroll order. `track` is the chapter's height in units of
 * 100lvh: chapters 1 and 2 are long because the drafting and the framing play across them. Later
 * rounds raise the other tracks when their animations land (only this value changes).
 */
export const CHAPTERS = [
  { id: 'architects', n: '01', nav: 'Architects', audience: 'For architects', track: 6 },
  { id: 'construction', n: '02', nav: 'Construction', audience: 'For construction companies', track: 8 },
  { id: 'trades', n: '03', nav: 'Trades', audience: 'For the trades', track: 2 },
  { id: 'contractors', n: '04', nav: 'Contractors', audience: 'For contractors', track: 2 },
  { id: 'agents', n: '05', nav: 'Agents', audience: 'For real estate agents', track: 2 },
] as const

export type ChapterId = (typeof CHAPTERS)[number]['id']

export const chapterIndex = (id: string): number => CHAPTERS.findIndex((c) => c.id === id)
