/**
 * The hero's one timing table (owner: hero lane). Defaults come from the D2
 * storyboard; packetSpeed is shared by the SVG mechanism and the 3D scene.
 */
export const HERO = {
  sketchStart: 120,
  toolDur: 360,
  toolGap: 70,
  lineStart: 560,
  lineDur: 300,
  lineGap: 45,
  notesAt: 900,
  noteGap: 60,
  peopleAt: 1160,
  cloudsStart: 1320,
  cloudDur: 250,
  cloudGap: 60,
  scanStart: 1750,
  scanDur: 1200,
  decisionAt: 2950,
  tiltDur: 1600,
  loop: 6000,
  loops: 3,
  lateHandoffAt: 8950,
  packetSpeed: 140,
} as const
