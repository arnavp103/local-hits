import Combobox from '@github/combobox-nav'
import { searchAreas } from './api.ts'
import type { Area } from './places.ts'

export function attachSearch(
  form: HTMLFormElement,
  status: HTMLElement,
  choose: (area: Area) => void,
) {
  const input = form.querySelector('input')!
  const list = form.querySelector<HTMLElement>('[role="listbox"]')!
  const box = new Combobox(input, list, {
    tabInsertsSuggestions: false,
    firstOptionSelectionMode: 'active',
  })
  const cache = new Map<string, Area[]>()
  let controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<Area[]> | undefined
  let options: Area[] = []
  let submitFirst = false

  function dismiss() {
    clearTimeout(timer)
    timer = undefined
    controller.abort()
    controller = new AbortController()
    pending = undefined
    submitFirst = false
    options = []
    box.stop()
    list.hidden = true
    list.replaceChildren()
    status.textContent = ''
  }
  function commit(area: Area) {
    dismiss()
    input.value = area.name
    choose(area)
  }
  async function lookup() {
    clearTimeout(timer)
    timer = undefined
    if (pending) return
    const term = input.value.trim()
    if (!term) return
    const key = term.toLowerCase()
    const { signal } = controller
    status.textContent = 'Searching…'
    pending = cache.has(key)
      ? Promise.resolve(cache.get(key)!)
      : searchAreas(term, signal)
    try {
      const matches = await pending
      if (signal.aborted) return
      if (cache.size >= 40 && !cache.has(key))
        cache.delete(cache.keys().next().value!)
      cache.set(key, matches)
      if (submitFirst && matches.length) {
        commit(matches[0])
        return
      }
      status.textContent = matches.length
        ? ''
        : 'No matches. Try a neighbourhood, city or postcode.'
      options = matches
      const rows = matches.map((area, i) => {
        const item = document.createElement('li')
        item.id = 'match-' + i
        item.dataset.index = String(i)
        item.setAttribute('role', 'option')
        const [name, ...context] = area.name.split(', ')
        const title = document.createElement('strong')
        title.textContent = name
        const detail = document.createElement('small')
        detail.textContent = context.join(', ')
        item.append(title, detail)
        return item
      })
      list.replaceChildren(...rows)
      list.hidden = !rows.length
      if (rows.length) box.start()
    } catch {
      if (!signal.aborted)
        status.textContent =
          'Place search is unavailable. Try again or use your location.'
    } finally {
      if (!signal.aborted) pending = undefined
    }
  }
  function schedule() {
    dismiss()
    if (input.value.trim().length >= 2) timer = setTimeout(lookup, 260)
  }
  input.addEventListener('input', (event) => {
    if ((event as InputEvent).isComposing) dismiss()
    else schedule()
  })
  input.addEventListener('compositionend', schedule)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      dismiss()
    }
    if (
      event.key === 'ArrowDown' &&
      list.hidden &&
      input.value.trim().length >= 2
    )
      void lookup()
  })
  form.onsubmit = (event) => {
    event.preventDefault()
    if (options.length) {
      commit(options[0])
      return
    }
    submitFirst = true
    void lookup()
  }
  list.addEventListener('combobox-commit', (event) => {
    const index = (event.target as HTMLElement).closest<HTMLElement>(
      '[role="option"]',
    )?.dataset.index
    if (index !== undefined && options[Number(index)])
      commit(options[Number(index)])
  })
  // Keep mouse focus on the input until the package receives the option click.
  list.addEventListener('mousedown', (event) => event.preventDefault())
  form.addEventListener('focusout', (event) => {
    if (
      !form.contains(event.relatedTarget as Node | null) &&
      (timer || pending || !list.hidden)
    )
      dismiss()
  })
  document.addEventListener('pointerdown', (event) => {
    if (
      !form.contains(event.target as Node) &&
      (timer || pending || !list.hidden)
    )
      dismiss()
  })
  return dismiss
}
