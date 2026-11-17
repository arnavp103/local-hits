export type Category = 'Food' | 'Nightlife' | 'Sights'
export type Unit = 'km' | 'mi'
export interface Point {
  lat: number
  lon: number
}
export interface Area extends Point {
  name: string
  country: string
}
export interface Place extends Point {
  title: string
  article: string
  tags: Category[]
  kind: string
  brief: string
  note?: string
  photo?: string
  former?: boolean
}

export const toronto: Area = {
  name: 'Toronto',
  country: 'CA',
  lat: 43.6477,
  lon: -79.3751,
}
export const walkLimitMinutes = 30
const walkingKmPerMinute = 4.8 / 60
const streetDistanceFactor = 1.25
export const radius =
  (walkLimitMinutes * walkingKmPerMinute) / streetDistanceFactor
export function walkMinutes(straightLineKm: number) {
  return Math.max(
    1,
    Math.round((straightLineKm * streetDistanceFactor) / walkingKmPerMinute),
  )
}
export function distance(a: Point, b: Point) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}

// Road-distance conventions apply to the search origin, including its territory.
const miles = new Set(
  'US GB AS GU MP VI AI AG BS BZ VG DM FK GD GG IM JE KN LC MS SH TC VC KY IO MH FM PW'.split(
    ' ',
  ),
)
export function unitFor(country: string): Unit {
  return miles.has(country.toUpperCase()) ? 'mi' : 'km'
}

export function formatDistance(km: number, unit: Unit) {
  const value = unit === 'mi' ? km / 1.609344 : km
  return (value > 0 && value < 0.1 ? '<0.1' : value.toFixed(1)) + ' ' + unit
}

export function key(article: string) {
  return decodeURIComponent(article.split('/wiki/').pop() ?? article)
    .replaceAll('_', ' ')
    .toLowerCase()
}

export function classify(title: string, description: string, extract: string) {
  const first = extract.split(/(?<=[.!?])\s+/)[0] ?? ''
  const identity = description || first
  const closed =
    /\b(former|defunct|demolished|disused|inactive|permanently closed)\b/i
  const former =
    closed.test(identity) ||
    closed.test(first) ||
    /\bwas (?:an? |the )(?:[^.]{0,45} )?(?:theatre|theater|cinema|nightclub|restaurant|bar|club|venue|pub|tavern|hotel|concert hall)\b/i.test(
      first,
    ) ||
    /\b(?:permanently closed|closed (?:permanently|for good|its doors in \d{4}))\b/i.test(
      extract,
    )
  if (former) {
    const survives =
      !/\b(demolished|razed)\b/i.test(extract) &&
      /\b(still stands|building survives|now (?:houses|serves as|operates as)|converted into)\b/i.test(
        extract,
      )
    return {
      tags: survives ? (['Sights'] as Category[]) : [],
      former: true,
      hide: !survives,
    }
  }
  const tags: Category[] = []
  // The place type is in the description or predicate. A photograph of a square is not itself a sight.
  const text = description || first.split(/\b(?:is|are)\s+/i).at(-1) || title
  if (
    /\b(restaurants?|caf[ée]s?|baker(?:y|ies)|food (?:hall|market)|public market|steakhouse|pizzeria|diner|eatery)\b/i.test(
      text,
    )
  )
    tags.push('Food')
  if (
    /\b(nightclubs?|clubs? for live music|music (?:venue|club)|concert (?:hall|venue)|jazz club|pubs?|bars?|tavern|brewpub|cabaret)\b/i.test(
      text,
    )
  )
    tags.push('Nightlife')
  if (
    /\b(museum|gallery|historic (?:site|building)|landmark|gardens?|parks?|monument|statue|sculpture|cathedral|castle|tower|bridge|beach|palace|square|theat(?:re|er)|attraction|memorial|fortress|abbey|temple)\b/i.test(
      text,
    )
  )
    tags.push('Sights')
  return { tags, former: false, hide: false }
}

export function nearby(area: Point, curated: Place[], live: Place[]) {
  const byArticle = new Map<string, Place>()
  for (const p of [...live, ...curated]) {
    if (distance(area, p) <= radius) byArticle.set(key(p.article), p)
  }
  return [...byArticle.values()].sort(
    (a, b) => distance(area, a) - distance(area, b),
  )
}
