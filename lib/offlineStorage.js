/**
 * Offline-First Data Layer and Background Sync Engine for Seva Health.
 * 
 * Guarantees that ASHA workers can:
 * 1. View patient records offline without internet.
 * 2. Record visits with local CDSS analysis completely offline.
 * 3. Store pending visits in local storage queue.
 * 4. Automatically or manually sync with the SQLite server when connection returns.
 */

const STORAGE_KEYS = {
  PATIENTS: 'seva_offline_patients',
  VISITS: 'seva_offline_visits',
  FOLLOWUPS: 'seva_offline_followups',
  LAST_SYNC: 'seva_last_sync_timestamp'
}

// Initial offline seed patients so the app works even if opened for the first time offline
export const SEED_PATIENTS = [
  { id: 1, name: 'सविता माने', age: 24, phone: '9111111111', village: 'आंबेगाव', category: 'pregnant', weeks_pregnant: 32, risk_level: 'high', notes: 'उच्च रक्तदाब, डॉक्टरांचा सल्ला घेणे आवश्यक', worker_id: 1, last_visit: '2026-10-17' },
  { id: 2, name: 'अनिता गायकवाड', age: 19, phone: '9222222222', village: 'ओतूर', category: 'pregnant', weeks_pregnant: 28, risk_level: 'high', notes: 'कमी वजन, पोषण आहार आवश्यक', worker_id: 1, last_visit: '2026-10-13' },
  { id: 3, name: 'लक्ष्मी भोसले', age: 17, phone: '9333333333', village: 'आंबेगाव', category: 'pregnant', weeks_pregnant: 20, risk_level: 'high', notes: 'अल्पवयीन गरोदर माता, विशेष काळजी', worker_id: 1, last_visit: '2026-10-18' },
  { id: 4, name: 'राधा काळे', age: 26, phone: '9444444444', village: 'जुन्नर', category: 'pregnant', weeks_pregnant: 36, risk_level: 'medium', notes: 'नियमित प्रसूतीपूर्व तपासणी आवश्यक', worker_id: 1, last_visit: '2026-10-15' },
  { id: 5, name: 'सुजाता पाटील', age: 28, phone: '9555555555', village: 'मंचर', category: 'pregnant', weeks_pregnant: 24, risk_level: 'medium', notes: 'आरोग्य उत्तम, नियमित पोषण आहार सुरू', worker_id: 1, last_visit: '2026-10-10' },
  { id: 6, name: 'पुष्पा यादव', age: 30, phone: '9777777777', village: 'ओतूर', category: 'pregnant', weeks_pregnant: 12, risk_level: 'low', notes: 'पहिली प्रसूतीपूर्व तपासणी पूर्ण', worker_id: 1, last_visit: '2026-10-06' }
]

export function isDeviceOnline() {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/**
 * Retrieves patients from local storage, falling back to seed patients if empty.
 */
export function getLocalPatients() {
  if (typeof window === 'undefined') return SEED_PATIENTS
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS)
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(SEED_PATIENTS))
      return SEED_PATIENTS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_PATIENTS
  } catch (e) {
    return SEED_PATIENTS
  }
}

/**
 * Caches patients from server into local storage.
 */
export function cachePatientsLocally(patients = []) {
  if (typeof window === 'undefined' || !Array.isArray(patients) || patients.length === 0) return
  try {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients))
  } catch (e) {
    console.error('Failed to cache patients locally:', e)
  }
}

/**
 * Retrieves all stored visits, including pending offline visits.
 */
export function getLocalVisits() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VISITS)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

/**
 * Returns count of visits pending sync.
 */
export function getPendingSyncCount() {
  const visits = getLocalVisits()
  return visits.filter(v => !v.synced).length
}

/**
 * Saves a visit offline immediately, and if online, attempts to sync it with server.
 */
export async function saveVisitOfflineFirst(visitData) {
  const isOnline = isDeviceOnline()
  const localId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
  
  const newVisit = {
    ...visitData,
    local_id: localId,
    synced: false,
    sync_status: 'pending_sync', // 'pending_sync' | 'synced' | 'failed'
    created_at: new Date().toISOString()
  }

  // 1. Save to local storage queue
  const currentVisits = getLocalVisits()
  currentVisits.unshift(newVisit)
  try {
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(currentVisits))
  } catch (e) {
    console.error('Failed to save visit to localStorage:', e)
  }

  // 2. Update local patient's last visit and risk level immediately
  try {
    const patients = getLocalPatients()
    const patientIndex = patients.findIndex(p => p.id === visitData.patient_id)
    if (patientIndex !== -1) {
      patients[patientIndex].last_visit = new Date().toISOString().split('T')[0]
      const flags = visitData.flags || ''
      if (flags.includes('HIGH_BP') || flags.includes('TEEN_PREGNANCY') || flags.includes('MALNUTRITION')) {
        patients[patientIndex].risk_level = 'high'
      } else if (flags.includes('UNDERWEIGHT')) {
        patients[patientIndex].risk_level = 'medium'
      }
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients))
    }
  } catch (e) {}

  // 3. Notify app components that visit was recorded
  triggerSyncUpdateEvent()

  // 4. If online, attempt immediate sync
  if (isOnline) {
    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitData)
      })

      if (response.ok) {
        const result = await response.json()
        newVisit.synced = true
        newVisit.sync_status = 'synced'
        newVisit.server_id = result.id
        localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(currentVisits))
        triggerSyncUpdateEvent()
        return { success: true, offline: false, synced: true, visit: newVisit }
      }
    } catch (err) {
      console.warn('Network request failed, keeping visit queued locally for offline sync:', err)
    }
  }

  // Stored locally in offline mode
  return {
    success: true,
    offline: true,
    synced: false,
    visit: newVisit,
    message: 'इंटरनेट अनुपलब्ध: भेट स्थानिक मेमरीमध्ये सुरक्षित सेव्ह झाली आहे. इंटरनेट आल्यावर सिंक होईल.'
  }
}

/**
 * Flushes all pending offline visits to the server SQLite database.
 */
export async function syncPendingVisitsToServer() {
  if (!isDeviceOnline()) {
    return { success: false, reason: 'offline', syncedCount: 0 }
  }

  const visits = getLocalVisits()
  const pendingVisits = visits.filter(v => !v.synced)

  if (pendingVisits.length === 0) {
    return { success: true, syncedCount: 0, message: 'सर्व डेटा आधीच सिंक आहे.' }
  }

  let syncedCount = 0

  for (let i = 0; i < visits.length; i++) {
    if (!visits[i].synced) {
      try {
        const payload = {
          patient_id: visits[i].patient_id,
          worker_id: visits[i].worker_id,
          voice_transcript: visits[i].voice_transcript || '',
          bp_systolic: visits[i].bp_systolic,
          bp_diastolic: visits[i].bp_diastolic,
          weight: visits[i].weight,
          notes: visits[i].notes,
          flags: visits[i].flags
        }

        const res = await fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (res.ok) {
          const data = await res.json()
          visits[i].synced = true
          visits[i].sync_status = 'synced'
          visits[i].server_id = data.id
          syncedCount++
        }
      } catch (err) {
        console.error('Failed to sync item:', visits[i].local_id, err)
        break // Stop on connection failure
      }
    }
  }

  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(visits))
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString())
  triggerSyncUpdateEvent()

  return {
    success: true,
    syncedCount,
    remaining: visits.filter(v => !v.synced).length
  }
}

function triggerSyncUpdateEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('seva-sync-update', {
      detail: { pendingCount: getPendingSyncCount(), isOnline: isDeviceOnline() }
    }))
  }
}
