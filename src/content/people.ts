import { hold } from './hold'
import type { PeopleContent } from './types'

/**
 * The crew's FIELD / OFFICE / CODE tags below are a guess, not a fact: confirm
 * each person's set (types.ts keeps tags as plain strings, so this HOLD carries
 * them onto the punch list). Never rendered.
 */
export const crewTags = hold(
  'Crew tags: confirm FIELD, OFFICE and CODE for each person (crew-1 FIELD and OFFICE, crew-2 OFFICE and CODE, crew-3 CODE are a guess)',
  { id: 'people.tags', kind: 'text', prodFallback: null },
)

/**
 * The crew. Every fact is a HOLD until the owner fills it in; names are
 * essential. Roles have no production fallback: a role nobody has confirmed is
 * left out rather than shown as fact.
 */
export const people: PeopleContent = {
  /** Reads "Actual Engineer is {teamSize} people." */
  teamSize: hold('How many people the crew is, as a word, e.g. three', {
    id: 'people.teamSize',
    kind: 'count',
    prodFallback: 'a handful of',
  }),
  people: [
    {
      id: 'crew-1',
      name: hold('Crew member 1: full name', {
        id: 'people.crew-1.name',
        kind: 'name',
        essential: true,
        prodFallback: null,
      }),
      role: hold('Crew member 1: role', {
        id: 'people.crew-1.role',
        kind: 'role',
        prodFallback: null,
      }),
      tags: ['FIELD', 'OFFICE'], // a guess until people.tags is confirmed
      oneLine: hold('Crew member 1: one-line background', {
        id: 'people.crew-1.oneLine',
        kind: 'bio',
        prodFallback: null,
      }),
      bio: hold('Crew member 1: two-sentence bio', {
        id: 'people.crew-1.bio',
        kind: 'bio',
        prodFallback: null,
      }),
      askMeAbout: hold('Crew member 1: ask me about', {
        id: 'people.crew-1.askMeAbout',
        kind: 'text',
        prodFallback: null,
      }),
      photo: hold('Crew member 1: photo at /crew/crew-1.jpg (a real photo, no stock models)', {
        id: 'people.crew-1.photo',
        kind: 'photo',
        prodFallback: null,
      }),
      linkedin: hold('Crew member 1: LinkedIn URL', {
        id: 'people.crew-1.linkedin',
        kind: 'url',
        prodFallback: null,
      }),
    },
    {
      id: 'crew-2',
      name: hold('Crew member 2: full name', {
        id: 'people.crew-2.name',
        kind: 'name',
        essential: true,
        prodFallback: null,
      }),
      role: hold('Crew member 2: role', {
        id: 'people.crew-2.role',
        kind: 'role',
        prodFallback: null,
      }),
      tags: ['OFFICE', 'CODE'], // a guess until people.tags is confirmed
      oneLine: hold('Crew member 2: one-line background', {
        id: 'people.crew-2.oneLine',
        kind: 'bio',
        prodFallback: null,
      }),
      bio: hold('Crew member 2: two-sentence bio', {
        id: 'people.crew-2.bio',
        kind: 'bio',
        prodFallback: null,
      }),
      askMeAbout: hold('Crew member 2: ask me about', {
        id: 'people.crew-2.askMeAbout',
        kind: 'text',
        prodFallback: null,
      }),
      photo: hold('Crew member 2: photo at /crew/crew-2.jpg (a real photo, no stock models)', {
        id: 'people.crew-2.photo',
        kind: 'photo',
        prodFallback: null,
      }),
      linkedin: hold('Crew member 2: LinkedIn URL', {
        id: 'people.crew-2.linkedin',
        kind: 'url',
        prodFallback: null,
      }),
    },
    {
      id: 'crew-3',
      name: hold('Crew member 3: full name', {
        id: 'people.crew-3.name',
        kind: 'name',
        essential: true,
        prodFallback: null,
      }),
      role: hold('Crew member 3: role', {
        id: 'people.crew-3.role',
        kind: 'role',
        prodFallback: null,
      }),
      tags: ['CODE'], // a guess until people.tags is confirmed
      oneLine: hold('Crew member 3: one-line background', {
        id: 'people.crew-3.oneLine',
        kind: 'bio',
        prodFallback: null,
      }),
      bio: hold('Crew member 3: two-sentence bio', {
        id: 'people.crew-3.bio',
        kind: 'bio',
        prodFallback: null,
      }),
      askMeAbout: hold('Crew member 3: ask me about', {
        id: 'people.crew-3.askMeAbout',
        kind: 'text',
        prodFallback: null,
      }),
      photo: hold('Crew member 3: photo at /crew/crew-3.jpg (a real photo, no stock models)', {
        id: 'people.crew-3.photo',
        kind: 'photo',
        prodFallback: null,
      }),
      linkedin: hold('Crew member 3: LinkedIn URL', {
        id: 'people.crew-3.linkedin',
        kind: 'url',
        prodFallback: null,
      }),
    },
  ],
}
