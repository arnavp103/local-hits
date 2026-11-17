import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classify,
  distance,
  formatDistance,
  nearby,
  toronto,
  unitFor,
  type Place,
} from '../src/places.ts'
import data from '../src/toronto.json' with { type: 'json' }

test('distance follows the searched country, including split-unit jurisdictions', () => {
  for (const country of ['ca', 'FR', 'IE', 'PR', ''])
    assert.equal(unitFor(country), 'km')
  for (const country of ['GB', 'us', 'IM']) assert.equal(unitFor(country), 'mi')
  assert.equal(formatDistance(5, 'mi'), '3.1 mi')
  assert.equal(formatDistance(0.024, 'km'), '<0.1 km')
})
test('only surviving former venues enter Sights', () => {
  assert.deepEqual(
    classify(
      'Blue Note',
      'Former jazz club',
      'The building now houses a bookshop.',
    ).tags,
    ['Sights'],
  )
  assert.equal(
    classify('Blue Note', 'Former jazz club', 'It was demolished.').hide,
    true,
  )
  assert.equal(
    classify('Blue Note', '', 'The Blue Note was a jazz club.').hide,
    true,
  )
  assert.equal(
    classify('Blue Note', 'Jazz club', 'The venue permanently closed in 2020.')
      .hide,
    true,
  )
  assert.deepEqual(classify('Blue Note', 'Restaurant and jazz club', '').tags, [
    'Food',
    'Nightlife',
  ])
})
test('Toronto overrides matching live pages, filters to radius, and sorts by distance', () => {
  const curated = data as Place[]
  const duplicate = { ...curated[0], brief: 'Generic lead' }
  const outOfTown = {
    ...duplicate,
    lat: 50,
    article: 'https://en.wikipedia.org/wiki/Other',
  }
  const places = nearby(toronto, curated, [duplicate, outOfTown])
  assert.equal(places.length, curated.length)
  assert.ok(places.includes(curated[0]) && !places.includes(duplicate))
  const distances = places.map((p) => distance(toronto, p))
  assert.deepEqual(
    distances,
    distances.toSorted((a, b) => a - b),
  )
  assert.deepEqual(
    curated.filter((p) => p.former).map((p) => p.tags),
    [['Sights']],
  )
})

test('classifies the subject of the article, rather than landmarks in its title', () => {
  assert.deepEqual(
    classify(
      'Parliament Street from Trafalgar Square',
      'Photograph taken in London',
      '',
    ).tags,
    [],
  )
  assert.deepEqual(
    classify('Charles I', 'Equestrian statue in London', '').tags,
    ['Sights'],
  )
})
