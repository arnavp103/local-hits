const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  locate:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M6 18 18 6M7 6h11v11"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  All: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  Food: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18m11-18c-3 3-4 7-4 10h4m0-10v18"/>',
  Nightlife:
    '<path d="M8 17V6l12-3v11M8 9l12-3"/><ellipse cx="5.5" cy="18" rx="2.5" ry="2"/><ellipse cx="17.5" cy="15" rx="2.5" ry="2"/>',
  Sights: '<path d="m2 9 10-6 10 6H2Zm2 11h16M6 11v6m6-6v6m6-6v6"/>',
}
export type Icon = keyof typeof paths
export function icon(name: Icon) {
  return (
    '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    paths[name] +
    '</svg>'
  )
}
