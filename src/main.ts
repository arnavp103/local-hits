import { attachSearch } from './search.ts'
import { wikiNearby, reverse } from './api.ts'
import {
  distance,
  formatDistance,
  nearby,
  walkLimitMinutes,
  walkMinutes,
  toronto,
  unitFor,
  type Area,
  type Category,
  type Place,
  type Unit,
} from './places.ts'
import { icon, type Icon } from './icons.ts'
import catalogue from './toronto.json'
import credits from './credits.json'

const curated = catalogue as Place[]
const categories = ['All', 'Food', 'Nightlife', 'Sights'] as const
type Filter = (typeof categories)[number]
const select = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
) {
  const el = document.createElement(tag)
  el.className = className
  el.textContent = text
  return el
}
function symbol(name: Icon) {
  const el = node('span')
  el.innerHTML = icon(name)
  return el
}
function link(text: string, href: string) {
  const el = node('a', text)
  el.href = href
  return el
}

let area = toronto
let places: Place[] = []
let filter: Filter = 'All'
let unit: Unit = unitFor(area.country)
let preferredUnit: Unit | undefined
let limit = 12
let loadFailed = false
let loading = false
let lookup = new AbortController()
let results = new AbortController()
const cards = select('cards')
const status = select('search-status')
const cardCache = new Map<Place, HTMLElement>()
const guide = select('guide')
const query = select<HTMLInputElement>('query')
const emptyFilter = () => {
  setFilter('All')
  select('tabs').querySelector('button')?.focus()
}

function travelLabel(place: Place) {
  const km = distance(area, place)
  return '≈ ' + walkMinutes(km) + ' min walk · ' + formatDistance(km, unit)
}
function card(p: Place) {
  const article = node('article', '', 'card')
  if (p.photo) {
    const image = node('img', '', 'card-image')
    image.src = p.photo
    image.loading = 'lazy'
    image.decoding = 'async'
    image.alt = ''
    article.append(image)
  }
  const body = node('div', '', 'card-body')
  const meta = node('div', '', 'metadata')
  const dist = node('span', '', 'distance')
  dist.title = 'Estimated walking time and straight-line distance'
  dist.textContent = travelLabel(p)
  meta.append(
    node('span', p.kind, 'kind ' + (p.tags[0]?.toLowerCase() || '')),
    dist,
  )
  body.append(meta, node('h3', p.title))
  if (p.former) body.append(node('div', 'Former venue', 'former'))
  body.append(node('p', p.brief))
  if (p.note) {
    const details = node('details')
    details.append(node('summary', 'Field note'), node('p', p.note))
    body.append(details)
  }
  const links = node('div', '', 'card-links')
  const wiki = link('Wikipedia', p.article)
  wiki.setAttribute('aria-label', p.title + ' on Wikipedia')
  const maps = link(
    'Map',
    'https://www.openstreetmap.org/?mlat=' +
      p.lat +
      '&mlon=' +
      p.lon +
      '#map=17/' +
      p.lat +
      '/' +
      p.lon,
  )
  maps.setAttribute('aria-label', 'Map of ' + p.title)
  wiki.append(symbol('external'))
  maps.append(symbol('external'))
  links.append(wiki, maps)
  body.append(links)
  article.append(body)
  return article
}
function render() {
  const visible =
    filter === 'All'
      ? places
      : places.filter((p) => p.tags.includes(filter as Category))
  select('area-name').textContent = area.name
  for (const u of ['mi', 'km'])
    select(u).setAttribute('aria-pressed', String(unit === u))
  for (const btn of select('tabs').querySelectorAll('button'))
    btn.setAttribute('aria-pressed', String(btn.dataset.name === filter))
  select('count').textContent =
    visible.length +
    (visible.length === 1 ? ' place' : ' places') +
    ' · Up to about ' +
    walkLimitMinutes +
    ' min on foot · Nearest first'
  const shown = visible.slice(0, limit).map((place) => {
    let el = cardCache.get(place)
    if (!el) {
      el = card(place)
      cardCache.set(place, el)
    }
    return el
  })
  for (const [index, article] of shown.entries()) {
    if (cards.children[index] !== article)
      cards.insertBefore(article, cards.children[index] || null)
  }
  while (cards.children.length > shown.length) cards.lastElementChild!.remove()
  if (visible.length === 0 && !loading && !loadFailed) {
    const box = node('div', '', 'empty')
    box.append(
      filter === 'All'
        ? 'No nearby places found. Try another neighbourhood.'
        : 'No places in this category nearby.',
    )
    if (filter !== 'All') {
      const all = node('button', 'Show all places')
      all.onclick = emptyFilter
      box.append(all)
    }
    cards.append(box)
  }
  select('more').hidden = visible.length <= limit
}
function setFilter(next: Filter) {
  filter = next
  limit = 12
  render()
}
for (const name of categories) {
  const btn = node('button', '', 'tab')
  btn.dataset.name = name
  btn.append(symbol(name), name)
  btn.onclick = () => setFilter(name)
  select('tabs').append(btn)
}
select('more').onclick = () => {
  const previous = limit
  limit += 12
  render()
  cards.children[previous]?.querySelector<HTMLElement>('summary, a')?.focus()
}
for (const u of ['km', 'mi'] as const)
  select(u).onclick = () => {
    preferredUnit = u
    updateUnit(u)
    render()
  }

function updateUnit(next: Unit) {
  unit = next
  for (const [place, el] of cardCache)
    el.querySelector<HTMLElement>('.distance')!.textContent = travelLabel(place)
}
function setArea(next: Area, focus = true) {
  results.abort()
  results = new AbortController()
  area = next
  cardCache.clear()
  select('starters').hidden = true
  guide.hidden = false
  query.value = next.name
  places = nearby(next, curated, [])
  limit = 12
  loading = true
  loadFailed = false
  unit = preferredUnit || unitFor(next.country)
  status.textContent = ''
  select('service').textContent = 'Finding nearby Wikipedia places…'
  render()
  if (focus) select('area-name').focus({ preventScroll: true })
  const signal = results.signal
  void wikiNearby(next, signal, (partial) => {
    if (!signal.aborted) {
      places = nearby(next, curated, partial)
      render()
    }
  })
    .then((live) => {
      if (signal.aborted) return
      places = nearby(next, curated, live)
      select('service').textContent = ''
    })
    .catch(() => {
      if (signal.aborted) return
      loadFailed = true
      const message = places.length
        ? 'Showing available places. Wikipedia could not load additional results.'
        : 'Wikipedia could not load places for this area.'
      const retry = node('button', 'Retry')
      retry.onclick = () => setArea(area, false)
      select('service').replaceChildren(message, retry)
    })
    .finally(() => {
      if (!signal.aborted) {
        loading = false
        render()
      }
    })
}
const dismissSearch = attachSearch(select('search'), status, chooseArea)
function chooseArea(next: Area) {
  lookup.abort()
  dismissSearch()
  filter = 'All'
  setArea(next)
}
query.addEventListener('input', () => lookup.abort())
query.addEventListener('focus', () => {
  if (!guide.hidden && query.value === area.name) query.select()
})
const starts: Record<string, Area> = {
  london: {
    name: 'Trafalgar Square, London',
    country: 'GB',
    lat: 51.50806,
    lon: -0.12806,
  },
  tokyo: {
    name: 'Sensō-ji, Tokyo',
    country: 'JP',
    lat: 35.71472,
    lon: 139.79675,
  },
  toronto: {
    ...toronto,
    name: 'Gooderham Building, Toronto',
    lat: 43.648366,
    lon: -79.374284,
  },
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-start]',
))
  button.onclick = () => chooseArea(starts[button.dataset.start!])
select('locate').onclick = () => {
  dismissSearch()
  lookup.abort()
  lookup = new AbortController()
  const signal = lookup.signal
  if (!navigator.geolocation) {
    status.textContent = 'Location is unavailable. Search by place name.'
    return
  }
  status.textContent = 'Finding your location…'
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (signal.aborted) return
      const point = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      }
      filter = 'All'
      setArea({ ...point, name: 'Your location', country: '' })
      try {
        const next = await reverse(point, signal)
        if (signal.aborted) return
        area = next
        query.value = next.name
        updateUnit(preferredUnit || unitFor(next.country))
        render()
      } catch {
        // The coordinates still work when a local name is unavailable.
      }
    },
    (error) => {
      if (!signal.aborted)
        status.textContent =
          error.code === 1
            ? 'Location permission was declined. Search by place name.'
            : 'Location is unavailable. Search by place name.'
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  )
}
const dialog = select<HTMLDialogElement>('about')
select('about-open').onclick = () => dialog.showModal()
select('credits-open').onclick = () => {
  dialog.showModal()
  select<HTMLDetailsElement>('photo-credits').open = true
  select('photo-credits').scrollIntoView({ block: 'nearest' })
}
select('close').onclick = () => dialog.close()
for (const c of credits) {
  const li = node('li')
  li.append(
    link(c.place, c.source),
    ' — ',
    c.artist,
    ', ',
    link(c.license, c.licenseUrl),
  )
  select('credit-list').append(li)
}
for (const el of document.querySelectorAll<HTMLElement>('[data-icon]'))
  el.append(symbol(el.dataset.icon as Icon))
