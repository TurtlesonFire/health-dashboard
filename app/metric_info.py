"""Plain-language descriptions of each metric.

Editorial content, not source data: these explain what a number means and how
a reader should use it, which neither the WHO nor the World Bank API supplies.
Kept in code (rather than the DB) so it versions with the app and needs no ETL
run to update. Served by GET /metric-info.

Each entry:
    what  — what the metric actually measures
    how   — how to read it / what it is and is not good for
"""

METRIC_INFO = {
    # ---------------------------------------------------------------- outcomes
    "WHOSIS_000001": {
        "what": "Average number of years a newborn baby would live if today's "
                "age-specific death rates stayed unchanged for their whole life.",
        "how": "A summary outcome measure, not a prediction for any individual. "
               "Read the direction and pace of change rather than the absolute "
               "number: gains of 0.1–0.2 years a year are normal. It is a "
               "lifetime average, so it responds slowly to recent events and "
               "will not show a single bad year.",
    },
    "WHOSIS_000002": {
        "what": "Years a newborn would live in full health, after discounting "
                "time lived with illness or disability (HALE).",
        "how": "Always read next to total life expectancy. The gap between the "
               "two is the average years lived in poor health — in the "
               "Philippines roughly 8 years. A rising gap means people are "
               "living longer but not necessarily healthier, which is a signal "
               "for chronic care and disability services rather than acute care.",
    },
    "MDG_0000000007": {
        "what": "Probability that a child born today dies before reaching age 5, "
                "expressed per 1,000 live births.",
        "how": "A core child-survival measure and the most sensitive indicator "
               "on this dashboard. Compare the wealth-quintile breakdown below "
               "to see whether gains are reaching the poorest households: the "
               "gap between Q1 and Q5 is usually far larger than the change "
               "from year to year, so equity is where the actionable work is.",
    },
    "MDG_0000000026": {
        "what": "Maternal deaths per 100,000 live births in a given year.",
        "how": "Read with caution at the year-to-year level — the count of "
               "maternal deaths is small, so the ratio is volatile and a single "
               "year can jump without meaning anything changed. Use 3–5 year "
               "averages and the long-run trend. The Philippines has stagnated "
               "near 85–120 while regional peers fell faster, which is the "
               "signal worth acting on.",
    },
    "SP.DYN.IMRT.IN": {
        "what": "Deaths of infants under 1 year old per 1,000 live births.",
        "how": "Narrower than under-5 mortality: it isolates the newborn and "
               "early-infancy period. When infant mortality is high but "
               "under-5 mortality is falling, the problem is concentrated in "
               "the first month of life — pointing at delivery care and "
               "neonatal services rather than child health generally.",
    },
    "SH.DYN.MORT": {
        "what": "World Bank estimate of deaths before age 5 per 1,000 live births.",
        "how": "The same concept as the WHO under-5 mortality series. Use one "
               "consistently; the two agencies use slightly different "
               "estimation methods, so small differences between them are "
               "methodological, not real.",
    },

    # ------------------------------------------------------- system / capacity
    "UHC_INDEX_REPORTED": {
        "what": "A 0–100 composite of service coverage across 14 tracer "
                "services — reproductive, maternal, child, infectious disease "
                "and non-communicable disease care.",
        "how": "An index, not a percentage of people covered, so 69 does not "
               "mean 69% of Filipinos have access. Use it to track whether "
               "coverage is improving overall, then look at which component "
               "services lag. It says nothing about quality or financial "
               "protection — read it alongside out-of-pocket spending.",
    },
    "SH.XPD.CHEX.GD.ZS": {
        "what": "All spending on health — public, private and out-of-pocket — "
                "as a share of the country's GDP.",
        "how": "Measures how much a country devotes to health relative to its "
               "economy, not whether that money is well spent. The Philippines "
               "spends around 5% of GDP, below the ~7% typical of "
               "upper-middle-income peers. Compare with the out-of-pocket share "
               "to see who is actually paying.",
    },
    "SH.XPD.OOPC.CH.ZS": {
        "what": "Share of total health spending paid directly by households at "
                "the point of care, rather than by government, insurance or "
                "donors.",
        "how": "The single best available proxy for financial hardship from "
               "illness. Above roughly 20% signals heavy reliance on direct "
               "payment; the Philippines sits near 44%, among the highest in "
               "the region. High out-of-pocket spending means people delay "
               "care or fall into debt — a health-financing problem, not a "
               "clinical one.",
    },
    "SH.MED.BEDS.ZS": {
        "what": "Inpatient hospital beds available per 1,000 people.",
        "how": "A crude capacity measure: it counts beds, not whether they are "
               "staffed, equipped or in the right place. The Philippines has "
               "under 1 per 1,000, below the global median. Because beds "
               "cluster in Metro Manila and other cities, the national average "
               "overstates availability where it is scarcest — a regional "
               "breakdown would be more informative than this line.",
    },
    "SH.MED.PHYS.ZS": {
        "what": "Practising physicians per 1,000 people.",
        "how": "Read together with distribution, not just the total. The "
               "Philippines trains more doctors than it retains: under 1 per "
               "1,000 nationally, but far fewer in poor provinces, and a large "
               "share of graduates emigrate. The national figure therefore "
               "understates the shortage where it matters most.",
    },
    "SH.IMM.IDPT": {
        "what": "Share of children aged 12–23 months who received the full "
                "three-dose diphtheria-tetanus-pertussis vaccine.",
        "how": "A standard proxy for how well routine immunisation reaches "
               "infants. Falls here usually mean supply or service-delivery "
               "problems rather than vaccine refusal, and are an early warning "
               "for outbreaks of vaccine-preventable disease.",
    },
    "SH.IMM.MEAS": {
        "what": "Share of children aged 12–23 months who received a measles-"
                "containing vaccine.",
        "how": "Track alongside DPT coverage. A widening gap between the two "
               "points to a specific failure in the measles programme, since "
               "the delivery platforms are largely shared.",
    },
    "SH.XPD.CHEX.PC.CD": {
        "what": "Total health spending per person per year, in current US "
                "dollars.",
        "how": "Converts national health spending into a per-person figure, "
               "useful for cross-country comparison. Because it is in US "
               "dollars, year-to-year movement mixes real changes in spending "
               "with exchange-rate movement — check the peso series before "
               "reading a change as real.",
    },
    "SH.MED.NURS.ZS": {
        "what": "Nursing and midwifery personnel per 1,000 people.",
        "how": "In the Philippines this figure is high by regional standards "
               "because of large training output, but many nurses work abroad "
               "or outside clinical care. Treat it as a measure of training "
               "capacity rather than of nurses available at the bedside.",
    },

    # ------------------------------------------------------- disease burden
    "MDG_0000000020": {
        "what": "Estimated new and relapsed tuberculosis cases per 100,000 "
                "people per year.",
        "how": "The Philippines carries one of the world's heaviest TB "
               "burdens, above 600 per 100,000. Compare with the treatment-"
               "coverage figures to see whether detection or cure is the "
               "binding constraint; incidence alone cannot tell you which.",
    },
    "MALARIA_CONF_CASES": {
        "what": "Total laboratory-confirmed malaria cases reported in the year.",
        "how": "A count, not a rate, so it moves with both transmission and "
               "testing volume. Malaria in the Philippines is concentrated in "
               "Palawan, Mindanao and Sulu, so a national total hides the "
               "geography — interpret it as progress toward elimination rather "
               "than as a national risk level.",
    },
    "SDGHIV": {
        "what": "Estimated new HIV infections per 1,000 uninfected people.",
        "how": "A rate, so it is comparable across years despite population "
               "growth. The Philippines is one of the few countries with a "
               "rising HIV epidemic, concentrated among young men and men who "
               "have sex with men. A rising line here is a genuine signal, not "
               "an artefact of better testing.",
    },
    "WHS2_131": {
        "what": "Probability of dying between ages 30 and 70 from cardiovascular "
                "disease, cancer, diabetes or chronic respiratory disease, per "
                "100,000 people, age-standardised.",
        "how": "Age-standardised so it is not distorted by population ageing. "
               "Non-communicable diseases now cause the majority of deaths in "
               "the Philippines, and this measures premature deaths — the ones "
               "largely preventable through blood-pressure and diabetes "
               "control, and tobacco reduction.",
    },
    "MH_12": {
        "what": "Suicide deaths per 100,000 people, age-standardised.",
        "how": "Interpret cautiously. Stigma and differing certification "
               "practices cause under-reporting that varies over time, and "
               "age-standardisation means the trend can differ from the crude "
               "count. The Philippine rate is low by global standards; treat "
               "changes as suggestive rather than definitive.",
    },

    # ----------------------------------------------------------- risk factors
    "M_Est_tob_curr": {
        "what": "Share of adults who currently use any tobacco product, "
                "age-standardised.",
        "how": "A leading modifiable driver of the NCD and TB burden. The "
               "national average hides a very wide sex gap — roughly 36% of men "
               "and 4% of women — so always check the sex split before "
               "designing an intervention.",
    },
    "NCD_BMI_30A": {
        "what": "Share of adults with a body-mass index of 30 or above, "
                "age-standardised estimate.",
        "how": "A modelled estimate, not a measured survey figure, so read the "
               "trend rather than the exact value. Obesity has risen steadily "
               "for four decades and drives diabetes and cardiovascular "
               "disease; it responds to food environment and urban design "
               "rather than to individual clinical advice alone.",
    },
    "SA_0000001688_ARCHIVED": {
        "what": "Litres of pure alcohol consumed per person aged 15 and over "
                "per year.",
        "how": "A population-level exposure measure that combines how many "
               "people drink with how much. It says nothing about patterns of "
               "heavy drinking, which drive most alcohol-related harm.",
    },

    # --------------------------------------------------------- context
    "SP.POP.TOTL": {
        "what": "Total resident population of the Philippines at mid-year.",
        "how": "Denominator for every per-capita and per-1,000 figure on this "
               "dashboard. Note the World Bank series and the PSA census can "
               "differ, so do not mix sources within one calculation.",
    },
    "NY.GDP.PCAP.CN": {
        "what": "Gross domestic product divided by mid-year population, in "
                "current Philippine pesos.",
        "how": "A broad measure of average economic output per person — not "
               "average income, and not what a typical household receives. It "
               "is a mean, so it is pulled up by the wealthy; median income is "
               "far lower. Use it as context for what the health system could "
               "afford, not as a measure of how well people live.",
    },
    "NY.GDP.PCAP.CD": {
        "what": "GDP divided by mid-year population, in current US dollars.",
        "how": "The US-dollar equivalent of the peso series, useful for "
               "cross-country comparison. Year-to-year movement mixes real "
               "growth with exchange-rate movement.",
    },
    "SP.POP.65UP.TO.ZS": {
        "what": "Share of the population aged 65 and over.",
        "how": "The Philippines is still relatively young at about 5.5%, but "
               "this share is rising fast. It is the forward-looking signal for "
               "health financing: an ageing population means more chronic "
               "disease, more long-term care and fewer working-age "
               "contributors per dependent.",
    },
    "SP.DYN.TFRT.IN": {
        "what": "Average number of children a woman would have over her "
                "lifetime at current age-specific fertility rates.",
        "how": "Falling fertility is why the population is ageing. A rate near "
               "or below 2.1 means the population eventually stops growing "
               "without migration, which changes the funding base for health "
               "and social insurance.",
    },
    "SH.H2O.SMDW.ZS": {
        "what": "Share of the population using drinking water that is safely "
                "managed — accessible on premises, available when needed, and "
                "free of contamination.",
        "how": "Stricter than mere 'access to an improved source': it includes "
               "water quality and reliability. A high access figure with a "
               "lower safely-managed figure points to contamination or "
               "intermittency rather than distance, which calls for treatment "
               "and piped supply rather than more wells.",
    },
    "SH.STA.SMSS.ZS": {
        "what": "Share of the population using sanitation facilities where "
                "excreta is safely disposed of in situ or treated off-site.",
        "how": "Measures safe disposal, not just the presence of a toilet. The "
               "gap between this and basic-sanitation figures is the share of "
               "households whose waste is not safely treated — the part that "
               "drives waterborne disease.",
    },
    "SH.STA.ACSN": {
        "what": "Share of the population with access to clean fuels and "
                "technology for cooking.",
        "how": "A strong proxy for household air pollution, which causes "
               "respiratory disease, especially in women and children. Low "
               "coverage usually means solid fuel use, so it tracks poverty "
               "closely.",
    },
}


def get_metric_info(code: str) -> dict | None:
    """Return the blurb for an indicator code, or None if none is written."""
    return METRIC_INFO.get(code)
