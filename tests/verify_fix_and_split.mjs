/**
 * Headless verification of the two changes:
 *   1. the sex filter fix — null-sex indicators must now produce non-empty series
 *   2. React.lazy code-splitting — the initial bundle must exclude Recharts
 *
 * Runs against the live backend so the assertions use real Philippine data.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const API = 'http://localhost:8000'
const DIST = 'C:/Users/Asus/health-dashboard/frontend/dist/assets'

// ---- mirror of frontend/src/api.js -----------------------------------------
const SEX_BOTH = 'SEX_BTSX'
const isBothSexes = (row) => row.sex === SEX_BOTH || row.sex == null
const bothSexesSeries = (rows) =>
  (rows ?? []).filter(isBothSexes).sort((a, b) => a.year - b.year)

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`)
  }
}

async function getJSON(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}

// ---- 1. every indicator the modules consume must yield a non-empty series ---
const CONSUMED = [
  // OverviewModule
  ['WHOSIS_000001', 'Life expectancy'],
  ['WHOSIS_000002', 'HALE'],
  ['MDG_0000000007', 'U5MR'],
  ['MDG_0000000026', 'MMR'],
  ['SP.DYN.IMRT.IN', 'Infant mortality'],
  // CapacityModule
  ['SH.MED.BEDS.ZS', 'Hospital beds'],
  ['SH.MED.PHYS.ZS', 'Physicians'],
  ['SH.XPD.CHEX.GD.ZS', 'Health exp % GDP'],
  ['SH.XPD.OOPC.CH.ZS', 'OOP % CHE'],
  ['UHC_INDEX_REPORTED', 'UHC index'],
  // ContextModule
  ['SP.POP.TOTL', 'Population'],
  ['NY.GDP.PCAP.CD', 'GDP per capita'],
  ['SH.H2O.SMDW.ZS', 'Safe water'],
  ['SH.STA.SMSS.ZS', 'Sanitation'],
  ['SP.POP.65UP.TO.ZS', 'Population 65+'],
  // DiseaseBurdenModule
  ['MDG_0000000020', 'TB incidence'],
  ['MALARIA_CONF_CASES', 'Malaria cases'],
  ['SDGHIV', 'New HIV infections'],
  ['WHS2_131', 'NCD mortality'],
  ['MH_12', 'Suicide rate'],
  // RiskFactorsModule
  ['M_Est_tob_curr', 'Tobacco use'],
  ['NCD_BMI_30A', 'Obesity'],
]

console.log('='.repeat(78))
console.log('1. SEX FILTER — every chart/stat card must have data after the fix')
console.log('='.repeat(78))

const OLD_PREDICATE = (d) => d.sex === SEX_BOTH // the bug
let wouldBeEmpty = 0

for (const [code, label] of CONSUMED) {
  let rows
  try {
    rows = await getJSON(`/data/${code}`)
  } catch (e) {
    check(`${label} (${code})`, false, `fetch failed: ${e.message}`)
    continue
  }
  const now = bothSexesSeries(rows)
  const before = rows.filter(OLD_PREDICATE)
  if (before.length === 0 && now.length > 0) wouldBeEmpty++

  // The series must be non-empty, strictly increasing in year, and duplicate-free.
  const years = now.map((d) => d.year)
  const increasing = years.every((y, i) => i === 0 || y > years[i - 1])
  const noDupYears = new Set(years).size === years.length

  check(
    `${label} (${code})`,
    now.length > 0 && increasing && noDupYears,
    `rows=${now.length}${before.length === 0 ? ' (was EMPTY before fix)' : ''}` +
      `${!increasing ? ' *** years not increasing' : ''}` +
      `${!noDupYears ? ' *** duplicate years' : ''}`,
  )
}

console.log()
console.log(`  Indicators that were rendering EMPTY before the fix: ${wouldBeEmpty}`)
check('the fix rescued at least one empty chart', wouldBeEmpty > 0,
  `${wouldBeEmpty} rescued`)

// ---- 2. code-splitting: entry must not statically pull Recharts -------------
console.log()
console.log('='.repeat(78))
console.log('2. CODE-SPLITTING — initial bundle must exclude Recharts')
console.log('='.repeat(78))

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'))
const sizeOf = (f) => readFileSync(join(DIST, f), 'utf8').length
const entry = files.find((f) => /^index-/.test(f))
const entrySrc = readFileSync(join(DIST, entry), 'utf8')

check('entry chunk exists', Boolean(entry), entry)
check('module chunks were emitted', files.filter((f) => /Module-/.test(f)).length >= 5,
  `${files.filter((f) => /Module-/.test(f)).length} module chunks`)

// The big chunk holds Recharts; the entry must only reference it dynamically.
const bigChunks = files.filter((f) => sizeOf(f) > 200_000)
check('a Recharts-sized chunk exists', bigChunks.length >= 1,
  bigChunks.map((f) => `${f} ${(sizeOf(f) / 1024).toFixed(0)}kB`).join(', '))

for (const big of bigChunks) {
  const stem = big.replace(/\.js$/, '')
  const staticImport = new RegExp(`import[^;]*from"\\./${stem}\\.js"`).test(entrySrc)
  check(`entry does NOT statically import ${big}`, !staticImport)
}

// Entry must contain dynamic imports for each module.
const dynamicCount = (entrySrc.match(/import\("\.\/[A-Za-z0-9_-]+\.js"\)/g) || []).length
check('entry uses dynamic import() for modules', dynamicCount >= 5,
  `${dynamicCount} dynamic imports`)

const entryKB = sizeOf(entry) / 1024
const beforeKB = 564.96 // single-bundle size measured before the change
check(`initial JS is smaller than the old single bundle (${beforeKB} kB)`,
  entryKB < beforeKB, `${entryKB.toFixed(1)} kB now`)

console.log()
console.log('='.repeat(78))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
console.log('='.repeat(78))
process.exit(fail === 0 ? 0 : 1)
