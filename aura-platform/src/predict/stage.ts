// Playoff stage from a PandaScore match name ("Upper Bracket Semifinal 2: A vs B",
// "Grand final: ...") — a medal ladder so the big games stand out.
export interface Stage { label: string; level: 'qf' | 'sf' | 'gf'; bg: string }

const STAGE_BG = { qf: '#c98a4b', sf: '#c3cad4', gf: '#ffc93c' }

export function stageOf(matchName: string | null | undefined): Stage | null {
  const r = (matchName || '').split(':')[0].toLowerCase()
  const br = /upper bracket/.test(r) ? 'UB ' : /lower bracket/.test(r) ? 'LB ' : ''
  let s: Omit<Stage, 'bg'> | null = null
  if (/grand final/.test(r)) s = { label: 'Grand Final', level: 'gf' }
  else if (/semi-?final/.test(r)) s = { label: `${br}Semifinal`, level: 'sf' }
  else if (/quarter-?final/.test(r)) s = { label: `${br}Quarterfinal`, level: 'qf' }
  else if (br && /\bfinal\b/.test(r)) s = { label: `${br}Final`, level: 'sf' }
  else if (/^final\b/.test(r.trim())) s = { label: 'Grand Final', level: 'gf' }
  return s && { ...s, bg: STAGE_BG[s.level] }
}
