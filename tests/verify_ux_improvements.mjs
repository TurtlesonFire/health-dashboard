/**
 * Verification for the four UX improvements:
 *   1. equity cards name the metric they refer to
 *   2. GDP per capita is in Philippine pesos
 *   3. population is rendered compactly (millions), not a raw long number
 *   4. metrics carry a plain-language explanation
 *
 * Runs against the live backend so assertions use real data.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { API, SRC, DIST } from './env.mjs'

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`) }
}

async function getJSON(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}

// ---- import the real formatter so we test shipped logic, not a copy --------
// pathToFileURL, not string concatenation: on POSIX ('/home/runner/...')
// 'file:///' + path yields four slashes and an empty-authority URL.
const fmt = await import(pathToFileURL(join(SRC, 'format.js')).href)

// ============================================================ 2. peso GDP ===
console.log('='.repeat(78))
console.log('2. GDP per capita in Philippine pesos')
console.log('='.repeat(78))

const indicators = await getJSON('/indicators')
const peso = indicators.find((i) => i.code === 'NY.GDP.PCAP.CN')
check('NY.GDP.PCAP.CN is registered', Boolean(peso), peso?.name)
check('its unit is php', peso?.unit === 'php', `unit=${peso?.unit}`)
check('category is context', peso?.category === 'context')

const pesoRows = await getJSON('/data/NY.GDP.PCAP.CN')
check('peso series has data', pesoRows.length > 0, `${pesoRows.length} rows`)

const peso2024 = pesoRows.find((r) => r.year === 2024)
// World Bank: GDP per capita (current LCU) PHL 2024 = 228320.14
check('2024 peso value matches the World Bank LCU series',
  peso2024 && Math.abs(peso2024.value - 228320.14) < 1,
  `value=${peso2024?.value}`)

// Cross-check against the USD series and the official exchange rate.
const usdRows = await getJSON('/data/NY.GDP.PCAP.CD')
const usd2024 = usdRows.find((r) => r.year === 2024)
const impliedFx = peso2024.value / usd2024.value
check('implied FX rate equals the World Bank official rate (57.29 in 2024)',
  Math.abs(impliedFx - 57.29) < 0.05,
  `implied=${impliedFx.toFixed(2)}`)

check('peso values render with the ₱ symbol',
  fmt.formatValue(228320.14, 'php').startsWith('\u20B1'),
  fmt.formatValue(228320.14, 'php'))

// ==================================================== 3. population scale ===
console.log()
console.log('='.repeat(78))
console.log('3. Population rendered compactly, not a raw long number')
console.log('='.repeat(78))

const popRows = await getJSON('/data/SP.POP.TOTL')
const pop2024 = popRows.find((r) => r.year === 2024)
const popStr = fmt.formatValue(pop2024.value, 'count')
check('population formats to millions', /^115\.8M$/.test(popStr),
  `${pop2024.value} -> "${popStr}"`)
check('no unformatted long digit string',
  !/\d{9,}/.test(popStr), popStr)

check('small counts are not forced into millions',
  fmt.formatValue(1234, 'count') === '1,234',
  `1234 -> "${fmt.formatValue(1234, 'count')}"`)
check('axis ticks are compact too',
  fmt.formatAxisTick(115843670, 'count') === '115.8M',
  fmt.formatAxisTick(115843670, 'count'))

// malaria cases is also a count — must be compact, not 6-digit raw
const malRows = await getJSON('/data/MALARIA_CONF_CASES')
const malLatest = malRows[malRows.length - 1]
const malStr = fmt.formatValue(malLatest.value, 'count')
check('malaria case counts are compact as well',
  !/\d{5,}/.test(malStr), `${malLatest.value} -> "${malStr}"`)

// ======================================================= 4. metric blurbs ===
console.log()
console.log('='.repeat(78))
console.log('4. Plain-language metric explanations')
console.log('='.repeat(78))

const info = await getJSON('/metric-info')
check('/metric-info returns a map', info && typeof info === 'object',
  `${Object.keys(info).length} entries`)

// Every indicator the UI actually renders should have a blurb.
const RENDERED = [
  'WHOSIS_000001', 'WHOSIS_000002', 'MDG_0000000007', 'MDG_0000000026',
  'SP.DYN.IMRT.IN', 'SH.MED.BEDS.ZS', 'SH.MED.PHYS.ZS', 'SH.XPD.CHEX.GD.ZS',
  'SH.XPD.OOPC.CH.ZS', 'UHC_INDEX_REPORTED', 'SP.POP.TOTL', 'NY.GDP.PCAP.CN',
  'SH.H2O.SMDW.ZS', 'SH.STA.SMSS.ZS', 'SP.POP.65UP.TO.ZS', 'MDG_0000000020',
  'MALARIA_CONF_CASES', 'SDGHIV', 'WHS2_131', 'MH_12', 'M_Est_tob_curr',
  'NCD_BMI_30A',
]
const missing = RENDERED.filter((c) => !info[c]?.what || !info[c]?.how)
check('every rendered indicator has what + how', missing.length === 0,
  missing.length ? `missing: ${missing.join(', ')}` : `${RENDERED.length} covered`)

// The UHC index is the one the user called out — must be genuinely explanatory.
const uhc = info.UHC_INDEX_REPORTED
const uhcText = `${uhc.what} ${uhc.how}`
check('UHC index blurb warns it is an index, not a % of people',
  /index, not a percentage/i.test(uhcText),
  (uhcText.match(/[^.]*index, not a percentage[^.]*/i) || [''])[0].trim().slice(0, 70) + '…')
check('UHC index blurb explains how to use it', uhc.how.length > 60)

// ============================================== 1. equity cards name metric =
console.log()
console.log('='.repeat(78))
console.log('1. Equity cards identify the metric they describe')
console.log('='.repeat(78))

const overview = readFileSync(join(SRC, 'modules/OverviewModule.jsx'), 'utf8')
check('Overview defines the quintile metric name explicitly',
  /U5MR_NAME\s*=\s*'Under-5 mortality rate'/.test(overview))
check('equity block has a heading naming the metric',
  /Wealth inequality in \{U5MR_NAME\.toLowerCase\(\)\}/.test(overview))
check('equity cards label which quintile is which',
  /Poorest quintile \(Q1\) — bottom 20%/.test(overview) &&
  /Richest quintile \(Q5\) — top 20%/.test(overview))
check('equity gap card explains the ratio in words',
  /more likely to die before age 5/.test(overview))
check('quintile chart receives metricName',
  /metricName=\{U5MR_NAME\}/.test(overview))

const quintile = readFileSync(join(SRC, 'components/QuintileChart.jsx'), 'utf8')
check('QuintileChart renders the metric name in its caption',
  /Quintiles of/.test(quintile))

// ==================================================== wiring + build ========
console.log()
console.log('='.repeat(78))
console.log('5. Wiring and build integrity')
console.log('='.repeat(78))

// Every module must pass metricInfo through, or blurbs silently never show.
for (const m of ['OverviewModule', 'CapacityModule', 'ContextModule',
                 'DiseaseBurdenModule', 'RiskFactorsModule']) {
  const src = readFileSync(join(SRC, `modules/${m}.jsx`), 'utf8')
  const getsInfo = /getMetricInfo\(\)/.test(src)
  const passesInfo = /metricInfo=\{info\(/.test(src)
  check(`${m} fetches and passes metric info`, getsInfo && passesInfo,
    `fetch=${getsInfo} pass=${passesInfo}`)
}

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'))
check('build emitted module chunks',
  files.filter((f) => /Module-/.test(f)).length >= 5,
  `${files.filter((f) => /Module-/.test(f)).length} chunks`)

// The entry must still not statically pull Recharts (regression guard).
const entry = files.find((f) => /^index-/.test(f))
const entrySrc = readFileSync(join(DIST, entry), 'utf8')
const big = files.filter((f) => readFileSync(join(DIST, f), 'utf8').length > 200000)
let leaked = false
for (const b of big) {
  if (new RegExp(`import[^;]*from"\\./${b.replace(/\.js$/, '')}\\.js"`).test(entrySrc)) {
    leaked = true
  }
}
check('code-splitting still holds (no static Recharts in entry)', !leaked)

console.log()
console.log('='.repeat(78))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
console.log('='.repeat(78))
process.exit(fail === 0 ? 0 : 1)
