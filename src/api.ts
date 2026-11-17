import {
  classify,
  type Area,
  type Place,
  type Point,
  radius,
} from './places.ts'

async function request<T>(
  base: string,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<T> {
  const url = new URL(base)
  url.search = new URLSearchParams(params).toString()
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('Service unavailable')
  const data = await response.json()
  if (data.error) throw new Error('Service unavailable')
  return data
}

interface Feature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    city?: string
    district?: string
    state?: string
    country?: string
    countrycode?: string
    postcode?: string
  }
}
function areaFrom(f: Feature): Area {
  const p = f.properties
  const labels = [p.name || p.postcode || p.city, p.city || p.state, p.country]
  return {
    name: [...new Set(labels.filter(Boolean))].join(', '),
    country: p.countrycode || '',
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }
}
export async function searchAreas(q: string, signal: AbortSignal) {
  const data = await request<{ features: Feature[] }>(
    'https://photon.komoot.io/api/',
    { q, limit: '5', lang: 'en' },
    signal,
  )
  return data.features.map(areaFrom)
}
export async function reverse(point: Point, signal: AbortSignal) {
  const data = await request<{ features: Feature[] }>(
    'https://photon.komoot.io/reverse',
    { lat: String(point.lat), lon: String(point.lon), lang: 'en' },
    signal,
  )
  const p = data.features[0]?.properties
  return {
    ...point,
    name: p?.city || p?.district || 'Your location',
    country: p?.countrycode || '',
  }
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
const wiki = 'https://en.wikipedia.org/w/api.php'
interface GeoPage extends Point {
  pageid: number
  title: string
}
interface Article {
  pageid: number
  title: string
  description?: string
  extract?: string
}

export async function wikiNearby(
  point: Point,
  signal: AbortSignal,
  onBatch?: (places: Place[]) => void,
): Promise<Place[]> {
  const base = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
  }
  const geo = await request<{ query: { geosearch: GeoPage[] } }>(
    wiki,
    {
      ...base,
      list: 'geosearch',
      gscoord: point.lat.toFixed(5) + '|' + point.lon.toFixed(5),
      gsradius: String(radius * 1000),
      gslimit: '60',
      gsnamespace: '0',
    },
    signal,
  )
  const results: Place[] = []
  // TextExtracts accepts at most 20 intro extracts per query. Keep requests sequential.
  for (let i = 0; i < geo.query.geosearch.length; i += 20) {
    const group = geo.query.geosearch.slice(i, i + 20)
    const data = await request<{ query: { pages: Article[] } }>(
      wiki,
      {
        ...base,
        pageids: group.map((p) => p.pageid).join('|'),
        prop: 'extracts|description',
        exintro: '1',
        explaintext: '1',
        exchars: '700',
        exlimit: '20',
      },
      signal,
    )
    const pages = new Map(data.query.pages.map((p) => [p.pageid, p]))
    for (const p of group) {
      const article = pages.get(p.pageid)
      const extract = article?.extract?.trim() || ''
      const desc = article?.description || ''
      const { tags, former, hide } = classify(p.title, desc, extract)
      if (hide) continue
      const sentences = Array.from(segmenter.segment(extract), (part) =>
        part.segment.trim(),
      )
      const first =
        sentences[0] ||
        desc ||
        'Explore the history of this place on Wikipedia.'
      results.push({
        lat: p.lat,
        lon: p.lon,
        title: p.title,
        article:
          'https://en.wikipedia.org/wiki/' +
          encodeURIComponent(p.title.replaceAll(' ', '_')),
        brief: first,
        note: sentences.slice(1).join(' '),
        tags,
        kind: tags[0] || 'Wikipedia',
        former,
      })
    }
    onBatch?.(results)
  }
  return results
}
