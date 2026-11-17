import { wikiNearby, reverse, searchAreas } from './api.ts'
import {
  distance,
  formatDistance,
  nearby,
  radius,
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
let places = nearby(area, curated, [])
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
const choices = select('choices')
const guide = select('guide')
const query = select<HTMLInputElement>('query')
const emptyFilter = () => {
  setFilter('All')
  select('tabs').querySelector('button')?.focus()
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
  dist.append(symbol('pin'), formatDistance(distance(area, p), unit))
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
    ' within ' +
    formatDistance(radius, unit) +
    ' · Nearest first'
  cards.replaceChildren(...visible.slice(0, limit).map(card))
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
    unit = preferredUnit = u
    render()
  }

function clearChoices() {
  choices.replaceChildren()
  choices.hidden = true
}
function beginLookup() {
  lookup.abort()
  lookup = new AbortController()
  clearChoices()
  status.textContent = ''
  return lookup.signal
}
function setArea(next: Area, scroll = true) {
  results.abort()
  results = new AbortController()
  area = next
  places = nearby(next, curated, [])
  limit = 12
  loading = true
  loadFailed = false
  unit = preferredUnit || unitFor(next.country)
  status.textContent = ''
  clearChoices()
  select('service').textContent = 'Finding nearby Wikipedia places…'
  render()
  if (scroll) guide.scrollIntoView()
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
      retry.onclick = () => setArea(next, false)
      select('service').replaceChildren(message, retry)
    })
    .finally(() => {
      if (!signal.aborted) {
        loading = false
        render()
      }
    })
}
select('edition').onclick = () => {
  beginLookup()
  results.abort()
  area = toronto
  unit = preferredUnit || 'km'
  loading = false
  loadFailed = false
  places = nearby(area, curated, [])
  select('service').textContent = ''
  query.value = ''
  setFilter('All')
  guide.scrollIntoView()
}
query.addEventListener('input', beginLookup)
query.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') beginLookup()
})
select('search').onsubmit = async (e) => {
  e.preventDefault()
  const term = query.value.trim()
  if (!term) {
    query.focus()
    return
  }
  const signal = beginLookup()
  if (/^toronto(?:,? (?:on|ontario|canada))?$/i.test(term)) {
    setArea(toronto)
    return
  }
  status.textContent = 'Searching…'
  try {
    const found = await searchAreas(term, signal)
    if (signal.aborted) return
    if (found.length === 1) {
      setArea(found[0])
      return
    }
    status.textContent = found.length
      ? 'Choose a matching location.'
      : 'No matches. Try a city or postcode.'
    for (const match of found) {
      const btn = node('button', match.name)
      btn.onclick = () => {
        query.value = match.name
        setArea(match)
        select('area-name').focus({ preventScroll: true })
      }
      choices.append(btn)
    }
    choices.hidden = !found.length
    choices.querySelector('button')?.focus()
  } catch {
    if (!signal.aborted)
      status.textContent =
        'Place search is unavailable. Try again or explore Toronto.'
  }
}
select('locate').onclick = () => {
  const signal = beginLookup()
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
      let next: Area = { ...point, name: 'Your location', country: '' }
      try {
        next = await reverse(point, signal)
      } catch {
        /* Coordinates still work without a locality name. */
      }
      if (!signal.aborted) setArea(next)
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
render()
