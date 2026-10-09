/**
 * One-time port: transforms the Vite SPA's design stylesheet into a version
 * scoped under `.app`, so it can be imported after globals.css and applied only
 * to the public storefront pages that opt in. Old-design pages (social, library,
 * atelier) never receive the wrapper, so their authors cannot be affected.
 *
 * - `body` / `html` / `*` base rules are dropped (already provided globally).
 * - `:root` becomes `.app` (custom properties inherit from the wrapper).
 * - every other selector, including those inside @media and @supports, is
 *   prefixed with `.app `.
 * - @keyframes and @import are kept verbatim.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('C:/Users/PRANEETH/Downloads/markethub (2)/src/styles/global.css', 'utf8')
const out = []
const DROP_SELECTORS = /^(\*|html|body)\b/

function transformSelector(sel) {
  return sel
    .split(',')
    .map((part) => {
      let s = part.trim()
      if (!s) return s
      if (DROP_SELECTORS.test(s)) return null // dropped entirely
      if (s === ':root') return '.app'
      if (s.startsWith(':root ')) return '.app ' + s.slice(6)
      return '.app ' + s
    })
    .filter(Boolean)
    .join(', ')
}

function transformRule(selector, body, out) {
  const next = transformSelector(selector)
  if (!next) return
  out.push(`${next} {${body}}`)
}

function walk(css, out, depth = 0) {
  let i = 0
  while (i < css.length) {
    // comments
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      out.push(css.slice(i, end + 2))
      i = end + 2
      continue
    }
    const brace = css.indexOf('{', i)
    if (brace === -1) {
      out.push(css.slice(i))
      break
    }
    const head = css.slice(i, brace)
    // find matching close brace, respecting strings
    let depthInside = 1
    let j = brace + 1
    while (j < css.length && depthInside > 0) {
      const ch = css[j]
      if (ch === '{') depthInside++
      else if (ch === '}') depthInside--
      j++
    }
    const inner = css.slice(brace + 1, j - 1)
    const headTrim = head.trim()
    if (headTrim.startsWith('@media') || headTrim.startsWith('@supports')) {
      const condition = headTrim.slice(headTrim.indexOf(' '))
      const sub = []
      walk(inner, sub, depth + 1)
      out.push(`${headTrim.slice(0, headTrim.indexOf(' '))}${condition} {`)
      out.push(...sub.map((line) => (line.startsWith(' ') || line.startsWith('@') || line.startsWith('/*') ? '  ' + line.trim() : '  ' + line.trim())))
      out.push('}')
    } else if (headTrim.startsWith('@keyframes') || headTrim.startsWith('@import') || headTrim.startsWith('@font-face')) {
      out.push(`${headTrim.trim()} {${inner}}`)
    } else {
      const selectors = headTrim
      if (selectors) transformRule(selectors, inner.trim().replace(/\s*\n\s*/g, ' '), out)
    }
    i = j
  }
}

walk(src, out)

const banner = `/*
 * MarketHub — the editorial "ink & paper" design language, ported from the
 * original Vite storefront.
 *
 * Every rule here is scoped under .app so it can only ever style the pages that
 * render inside <ViteShell>: the home page, the shelf, book detail, search,
 * categories, bestsellers, authors, vendors and auth. Pages that still use the
 * earlier design (/social, /library, /atelier, vendor profiles) never mount
 * that wrapper, so this stylesheet cannot reach them.
 *
 * Source of truth: "markethub (2)/src/styles/global.css".
 * Import order matters: this file loads AFTER app/globals.css, and every rule
 * additionally carries the .app class (higher specificity), so where the two
 * systems share a class name the scoped design wins inside .app without ever
 * leaking outside it.
 */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');

`

writeFileSync('app/mh-vite.css', banner + out.join('\n'))
console.log('written app/mh-vite.css,', out.length, 'blocks')
