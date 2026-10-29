export const MARATHI_NAMES = {
  'Sunita Pawar': 'सुनिता पवार',
  'Rekha Shinde': 'रेखा शिंदे',
  'Kavita Jadhav': 'कविता जाधव',
  'Priya Kulkarni': 'प्रिया कुलकर्णी',
  'Supervisor Desai': 'पर्यवेक्षक देसाई',
  'Savita Mane': 'सविता माने',
  'Anita Gaikwad': 'अनिता गायकवाड',
  'Lakshmi Bhosale': 'लक्ष्मी भोसले',
  'Radha Kale': 'राधा काळे',
  'Sujata Patil': 'सुजाता पाटील',
  'Meena Thorat': 'मीना थोरात',
  'Pushpa Yadav': 'पुष्पा यादव',
  'Vimal Deshpande': 'विमल देशपांडे',
  'Ashwini Nimbalkar': 'अश्विनी निंबाळकर',
  'Chhaya Salve': 'छाया साळवे',
  'Nanda More': 'नंदा मोरे',
  'Shobha Pawar': 'शोभा पवार',
  'Uma Kshirsagar': 'उमा क्षीरसागर',
  'Kalpana Waghmare': 'कल्पना वाघमारे',
  'Sonal Jagtap': 'सोनल जगताप',
}

export const MARATHI_VILLAGES = {
  'Ambegaon': 'आंबेगाव',
  'Otur': 'ओतूर',
  'Junnar': 'जुन्नर',
  'Manchar': 'मंचर',
  'Narayangaon': 'नारायणगाव',
}

export function toMarathiName(name) {
  if (!name) return ''
  return MARATHI_NAMES[name] || name
}

export function toMarathiVillage(village) {
  if (!village) return ''
  return MARATHI_VILLAGES[village] || village
}

export function toMarathiInitial(name) {
  if (!name) return 'आ'
  const marathi = toMarathiName(name)
  // Handle two-character syllables like सु, पृ, etc. if needed or first character
  if (marathi.startsWith('सु')) return 'सु'
  if (marathi.startsWith('प्रि') || marathi.startsWith('प्र')) return 'प्र'
  if (marathi.startsWith('श्री')) return 'श्री'
  return marathi.charAt(0) || 'आ'
}

export function toMarathiFollowupType(type) {
  if (type === 'antenatal' || type === 'ANC') return 'प्रसूतीपूर्व तपासणी'
  if (type === 'child_health' || type === 'child') return 'बाल आरोग्य तपासणी'
  return 'आरोग्य तपासणी'
}

export function toMarathiDigits(num) {
  if (num === null || num === undefined) return ''
  const str = String(num)
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']
  return str.replace(/[0-9]/g, d => devanagariDigits[Number(d)])
}

export function formatMarathiDate(d, options = { day: 'numeric', month: 'short' }) {
  if (!d) return ''
  try {
    const formatted = new Date(d).toLocaleDateString('mr-IN', options)
    return toMarathiDigits(formatted)
  } catch (e) {
    return toMarathiDigits(String(d))
  }
}
