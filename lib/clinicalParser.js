/**
 * Marathi Clinical NLP & Rule-Based Clinical Decision Support System (CDSS)
 * 
 * Specifically calibrated for ASHA & Anganwadi maternal-child health protocols
 * based on National Health Mission (NHM) Maharashtra & WHO guidelines.
 * 
 * Replaces crude substring matching with clinical entity extraction and
 * deterministic threshold evaluation.
 */

// Devanagari to Arabic numeral mapping
const DEVANAGARI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

/**
 * Normalizes Marathi Devanagari digits to standard ASCII digits.
 * e.g., "१४०/९०" -> "140/90"
 */
export function normalizeMarathiDigits(text = '') {
  return String(text).replace(/[०-९]/g, d => DEVANAGARI_DIGITS[d] || d)
}

/**
 * Checks if a specific target phrase is negated in the text.
 * e.g. "ताप नाही", "रक्तदाब जास्त नाही", "कमी वजन नाही"
 */
function isNegated(text, term) {
  const clean = text.toLowerCase()
  const patterns = [
    new RegExp(`${term}\\s*(?:नाही|नव्हता|नसून|नसल्याचे|कमी झाले|सामान्य आहे)`, 'i'),
    new RegExp(`(?:नाही|कोणताही|कोणतीही)\\s*${term}`, 'i')
  ]
  return patterns.some(p => p.test(clean))
}

/**
 * Extracts Blood Pressure readings and applies clinical hypertension guidelines.
 * Normal BP: 90-120 / 60-80
 * Prehypertension: 120-139 / 80-89
 * High BP (Stage 1/2 Hypertension): Systolic >= 140 OR Diastolic >= 90
 * Low BP (Hypotension): Systolic < 90 OR Diastolic < 60
 */
export function extractBloodPressure(normalizedText, rawText) {
  let systolic = null
  let diastolic = null
  let detectedFlag = null
  let reason = null

  // Patterns like: "140/90", "140 / 90", "रक्तदाब 140 90", "बीपी 150 बाय 95", "140 आणि 90"
  const bpRegexes = [
    /(?:रक्तदाब|बीपी|bp|pressure)?\s*[:\-\s]?\s*(\d{2,3})\s*(?:\/|\s*बाय\s*|\s*आणि\s*|\s*,\s*)\s*(\d{2,3})/i,
    /(?:रक्तदाब|बीपी|bp)\s*[:\-\s]?\s*(\d{2,3})\s+(\d{2,3})/i,
    /(\d{2,3})\s*\/\s*(\d{2,3})/
  ]

  for (const regex of bpRegexes) {
    const match = normalizedText.match(regex)
    if (match) {
      const s = parseInt(match[1], 10)
      const d = parseInt(match[2], 10)
      // Plausible human BP ranges: systolic 70-240, diastolic 40-140
      if (s >= 70 && s <= 250 && d >= 40 && d <= 150) {
        systolic = s
        diastolic = d
        break
      }
    }
  }

  // Clinical evaluation based on extracted numbers
  if (systolic !== null && diastolic !== null) {
    if (systolic >= 140 || diastolic >= 90) {
      detectedFlag = 'HIGH_BP'
      reason = `सिस्टोलिक ${systolic} mmHg किंवा डायस्टोलिक ${diastolic} mmHg (उच्च रक्तदाब ≥ १४०/९०)`
    } else if (systolic < 90 || diastolic < 60) {
      detectedFlag = 'LOW_BP'
      reason = `सिस्टोलिक ${systolic} mmHg किंवा डायस्टोलिक ${diastolic} mmHg (कमी रक्तदाब < ९०/६०)`
    }
  } else {
    // If numbers were not spoken, check qualitative clinical phrases with negation safety
    const lower = rawText.toLowerCase()
    if (!isNegated(lower, 'रक्तदाब') && !isNegated(lower, 'बीपी')) {
      if (
        lower.includes('उच्च रक्तदाब') ||
        lower.includes('रक्तदाब जास्त') ||
        lower.includes('रक्तदाब वाढला') ||
        lower.includes('बीपी जास्त') ||
        lower.includes('बीपी हाय')
      ) {
        detectedFlag = 'HIGH_BP'
        reason = 'मराठी नोंदीत उच्च रक्तदाबाचा स्पष्ट उल्लेख'
      }
    }
  }

  // Explicit normal check cancels high BP
  if (
    rawText.includes('रक्तदाब सामान्य') ||
    rawText.includes('बीपी नॉर्मल') ||
    rawText.includes('रक्तदाब चांगला')
  ) {
    if (systolic === null || (systolic < 140 && diastolic < 90)) {
      detectedFlag = null
      reason = null
    }
  }

  return { systolic, diastolic, detectedFlag, reason }
}

/**
 * Extracts body weight and evaluates underweight / malnutrition flags.
 * Maternal underweight threshold: < 45 kg during pregnancy (NHM guideline).
 * CRITICAL FIX: Unrelated "कमी" (less) will NEVER trigger underweight!
 */
export function extractWeight(normalizedText, rawText) {
  let weight = null
  let detectedFlag = null
  let reason = null

  // Patterns like: "वजन ४५.५ किलो", "वजन 48 kg", "48.5 किलो वजन", "वजन 42"
  const weightRegexes = [
    /(?:वजन|weight)\s*[:\-\s]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:किलो|केजी|किलोग्राम|kg)?/i,
    /(\d{2,3}(?:\.\d{1,2})?)\s*(?:किलो|केजी|किलोग्राम|kg)\s*(?:वजन)?/i
  ]

  for (const regex of weightRegexes) {
    const match = normalizedText.match(regex)
    if (match) {
      const w = parseFloat(match[1])
      // Plausible maternal weight: 30kg - 140kg
      if (w >= 30 && w <= 140) {
        weight = w
        break
      }
    }
  }

  // Clinical evaluation
  if (weight !== null) {
    // NHM guideline: Pregnant woman weight under 45 kg is high/medium risk
    if (weight < 45) {
      detectedFlag = 'UNDERWEIGHT'
      reason = `वजन ${weight} किलो हे गरोदर मातेसाठी मानकापेक्षा कमी (< ४५ किलो)`
    }
  } else {
    // Contextual phrase check (MUST be paired with weight context, NOT bare "कमी")
    const lower = rawText.toLowerCase()
    const isWeightNegated = isNegated(lower, 'वजन कमी') || isNegated(lower, 'कमी वजन')

    if (!isWeightNegated) {
      if (
        lower.includes('कमी वजन') ||
        lower.includes('वजन कमी') ||
        lower.includes('वजन खूप कमी') ||
        lower.includes('वजन घटले') ||
        lower.includes('अंगणवाडी वजन घट') ||
        lower.includes('वजन भरत नाही')
      ) {
        detectedFlag = 'UNDERWEIGHT'
        reason = 'मराठी नोंदीत वजन कमी असल्याचा स्पष्ट क्लिनिकल उल्लेख'
      }
    }
  }

  return { weight, detectedFlag, reason }
}

/**
 * Extracts Body Temperature / Fever indicators.
 * Normal: 97°F - 99°F
 * Fever: >= 100°F (or > 37.8°C)
 */
export function extractFever(normalizedText, rawText) {
  let temperature = null
  let detectedFlag = null
  let reason = null

  const tempRegex = /(?:ताप|temperature|temp)\s*[:\-\s]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:डिग्री|फॅरनहाइट|f)?/i
  const match = normalizedText.match(tempRegex)
  if (match) {
    const t = parseFloat(match[1])
    if (t >= 95 && t <= 106) {
      temperature = t
      if (t >= 100) {
        detectedFlag = 'FEVER'
        reason = `ताप ${temperature}°F (तीव्र ताप ≥ १००°F)`
      }
    }
  }

  if (!detectedFlag) {
    const lower = rawText.toLowerCase()
    if (!isNegated(lower, 'ताप') && !isNegated(lower, 'थंडी')) {
      if (
        lower.includes('तीव्र ताप') ||
        lower.includes('खूप ताप') ||
        lower.includes('थंडी वाजून ताप') ||
        lower.includes('अंग गरम') ||
        lower.includes('ताप आला')
      ) {
        detectedFlag = 'FEVER'
        reason = 'मराठी नोंदीत तीव्र ताप/थंडी वाजण्याचा उल्लेख'
      }
    }
  }

  return { temperature, detectedFlag, reason }
}

/**
 * Evaluates severe maternal/child conditions (Anemia, Malnutrition, Teen Pregnancy).
 */
export function extractOtherConditions(normalizedText, rawText) {
  const flags = []
  const explanations = []
  const lower = rawText.toLowerCase()

  // 1. ANEMIA / रक्तक्षय
  if (!isNegated(lower, 'रक्तक्षय') && !isNegated(lower, 'अॅनिमिया') && !isNegated(lower, 'अ‍ॅनिमिया')) {
    // Check hemoglobin number: e.g. "हिमोग्लोबिन 8.5"
    const hbMatch = normalizedText.match(/(?:हिमोग्लोबिन|hb)\s*[:\-\s]?\s*(\d{1,2}(?:\.\d{1,2})?)/i)
    if (hbMatch) {
      const hb = parseFloat(hbMatch[1])
      if (hb < 10.0) {
        flags.push('ANEMIA')
        explanations.push({
          flag: 'ANEMIA',
          label: 'रक्तक्षय (अॅनिमिया)',
          reason: `हिमोग्लोबिन ${hb} g/dL (अति जोखीम < १० g/dL)`
        })
      }
    } else if (
      lower.includes('रक्तक्षय') ||
      lower.includes('अॅनिमिया') ||
      lower.includes('अ‍ॅनिमिया') ||
      lower.includes('पांढरी नखे') ||
      lower.includes('रक्ताची कमतरता') ||
      lower.includes('डोळे पांढरे पडले')
    ) {
      flags.push('ANEMIA')
      explanations.push({
        flag: 'ANEMIA',
        label: 'रक्तक्षय (अॅनिमिया)',
        reason: 'रक्तक्षय / अॅनिमियाची क्लिनिकल लक्षणे आढळली'
      })
    }
  }

  // 2. MALNUTRITION / कुपोषण
  if (!isNegated(lower, 'कुपोषण') && !isNegated(lower, 'कुपोषित')) {
    if (
      lower.includes('कुपोषण') ||
      lower.includes('कुपोषित') ||
      lower.includes('सॅम बालक') ||
      lower.includes('मॅम बालक') ||
      lower.includes('दंड घेर कमी') ||
      lower.includes('लाल पट्टी') ||
      lower.includes('muac')
    ) {
      flags.push('MALNUTRITION')
      explanations.push({
        flag: 'MALNUTRITION',
        label: 'कुपोषण',
        reason: 'बालकामध्ये तीव्र कुपोषणाची लक्षणे नोंदवली'
      })
    }
  }

  // 3. TEEN PREGNANCY / अल्पवयीन गर्भधारणा
  if (
    lower.includes('अल्पवयीन') ||
    lower.includes('कमी वयात गरोदर') ||
    lower.includes('वय १७') ||
    lower.includes('वय १६') ||
    lower.includes('वय १५')
  ) {
    flags.push('TEEN_PREGNANCY')
    explanations.push({
      flag: 'TEEN_PREGNANCY',
      label: 'अल्पवयीन गर्भधारणा',
      reason: 'वय १८ वर्षांपेक्षा कमी असल्याने उच्च जोखीम'
    })
  }

  return { flags, explanations }
}

/**
 * Master parser: Analyzes raw spoken or typed Marathi text.
 * Returns parsed clinical measurements, risk flags, and explainable audit trail.
 */
export function parseMarathiClinicalText(rawText = '') {
  if (!rawText || !rawText.trim()) {
    return {
      bp_systolic: null,
      bp_diastolic: null,
      weight: null,
      temperature: null,
      flags: [],
      explanations: [],
      hasObservations: false
    }
  }

  const normalized = normalizeMarathiDigits(rawText)
  const bpResult = extractBloodPressure(normalized, rawText)
  const weightResult = extractWeight(normalized, rawText)
  const feverResult = extractFever(normalized, rawText)
  const otherResult = extractOtherConditions(normalized, rawText)

  const flags = []
  const explanations = []

  if (bpResult.detectedFlag) {
    flags.push(bpResult.detectedFlag)
    explanations.push({
      flag: bpResult.detectedFlag,
      label: bpResult.detectedFlag === 'HIGH_BP' ? 'उच्च रक्तदाब' : 'कमी रक्तदाब',
      reason: bpResult.reason
    })
  }

  if (weightResult.detectedFlag) {
    flags.push(weightResult.detectedFlag)
    explanations.push({
      flag: 'UNDERWEIGHT',
      label: 'कमी वजन',
      reason: weightResult.reason
    })
  }

  if (feverResult.detectedFlag) {
    flags.push(feverResult.detectedFlag)
    explanations.push({
      flag: 'FEVER',
      label: 'ताप / थंडी वाजणे',
      reason: feverResult.reason
    })
  }

  for (let i = 0; i < otherResult.flags.length; i++) {
    flags.push(otherResult.flags[i])
    explanations.push(otherResult.explanations[i])
  }

  return {
    bp_systolic: bpResult.systolic,
    bp_diastolic: bpResult.diastolic,
    weight: weightResult.weight,
    temperature: feverResult.temperature,
    flags: [...new Set(flags)],
    explanations,
    hasObservations: flags.length > 0 || bpResult.systolic !== null || weightResult.weight !== null
  }
}
