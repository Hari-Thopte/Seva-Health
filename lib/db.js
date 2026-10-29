import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'
import fs from 'fs'

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || Boolean(process.env.LAMBDA_TASK_ROOT)

function getDatabasePath() {
  if (isServerless) {
    const tmpPath = path.join(os.tmpdir(), 'seva-health.db')
    const cwdPath = path.join(process.cwd(), 'seva-health.db')
    if (fs.existsSync(cwdPath) && !fs.existsSync(tmpPath)) {
      try {
        fs.copyFileSync(cwdPath, tmpPath)
      } catch (e) {
        console.warn('Failed to copy seed db to tmp:', e)
      }
    }
    return tmpPath
  }
  return path.join(process.cwd(), 'seva-health.db')
}

let db

export function getDb() {
  if (!db) {
    try {
      const dbPath = getDatabasePath()
      db = new DatabaseSync(dbPath)
    } catch (err) {
      console.warn('Failed to open file database, falling back to in-memory SQLite:', err)
      db = new DatabaseSync(':memory:')
    }
    if (!db.pragma) {
      db.pragma = (p) => db.exec(`PRAGMA ${p}`)
    }
    try {
      db.pragma('journal_mode = WAL')
    } catch (e) {}
    try {
      db.pragma('foreign_keys = ON')
    } catch (e) {}
    initSchema(db)
    seedData(db)
  }
  return db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      village TEXT,
      block TEXT,
      role TEXT DEFAULT 'asha',
      email TEXT,
      otp TEXT,
      otp_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      phone TEXT,
      village TEXT,
      category TEXT DEFAULT 'pregnant',
      weeks_pregnant INTEGER,
      children_count INTEGER DEFAULT 0,
      risk_level TEXT DEFAULT 'low',
      worker_id INTEGER REFERENCES workers(id),
      last_visit DATETIME,
      next_followup DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER REFERENCES patients(id),
      worker_id INTEGER REFERENCES workers(id),
      visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      voice_transcript TEXT,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      weight REAL,
      notes TEXT,
      flags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER REFERENCES patients(id),
      worker_id INTEGER REFERENCES workers(id),
      due_date DATETIME NOT NULL,
      type TEXT DEFAULT 'antenatal',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  try {
    db.exec(`ALTER TABLE workers ADD COLUMN email TEXT;`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE workers ADD COLUMN otp TEXT;`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE workers ADD COLUMN otp_expires_at DATETIME;`)
  } catch (e) {}

  try {
    db.exec(`
      UPDATE workers SET email = 'sunita.pawar@seva.gov.in', phone = '8329373147' WHERE (name = 'Sunita Pawar' OR name = 'सुनिता पवार');
      UPDATE workers SET email = 'rekha.shinde@seva.gov.in' WHERE (name = 'Rekha Shinde' OR name = 'रेखा शिंदे') AND (email IS NULL OR email = '');
      UPDATE workers SET email = 'kavita.jadhav@seva.gov.in' WHERE (name = 'Kavita Jadhav' OR name = 'कविता जाधव') AND (email IS NULL OR email = '');
      UPDATE workers SET email = 'priya.kulkarni@seva.gov.in' WHERE (name = 'Priya Kulkarni' OR name = 'प्रिया कुलकर्णी') AND (email IS NULL OR email = '');
      UPDATE workers SET email = 'desai.supervisor@seva.gov.in' WHERE (name = 'Supervisor Desai' OR name = 'पर्यवेक्षक देसाई') AND (email IS NULL OR email = '');
    `)
  } catch (e) {}
}

function seedData(db) {
  const workerCount = db.prepare('SELECT COUNT(*) as c FROM workers').get().c
  if (workerCount > 0) return

  // Insert workers
  const insertWorker = db.prepare(`
    INSERT INTO workers (name, phone, village, block, role) VALUES (?, ?, ?, ?, ?)
  `)
  insertWorker.run('सुनिता पवार', '8329373147', 'आंबेगाव', 'जुन्नर', 'asha')
  insertWorker.run('रेखा शिंदे', '9765432109', 'नारायणगाव', 'जुन्नर', 'asha')
  insertWorker.run('कविता जाधव', '9654321098', 'ओतूर', 'जुन्नर', 'asha')
  insertWorker.run('प्रिया कुलकर्णी', '9543210987', 'मंचर', 'आंबेगाव', 'asha')
  insertWorker.run('पर्यवेक्षक देसाई', '9432109876', 'जुन्नर', 'जुन्नर', 'supervisor')

  // Insert patients
  const insertPatient = db.prepare(`
    INSERT INTO patients (name, age, phone, village, category, weeks_pregnant, risk_level, worker_id, last_visit, next_followup, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const today = new Date()
  const d = (offset) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString().split('T')[0]
  }

  // High-risk patients
  insertPatient.run('सविता माने', 24, '9111111111', 'आंबेगाव', 'pregnant', 32, 'high', 1, d(-3), d(-1), 'उच्च रक्तदाब, डॉक्टरांचा सल्ला घेणे आवश्यक')
  insertPatient.run('अनिता गायकवाड', 19, '9222222222', 'ओतूर', 'pregnant', 28, 'high', 1, d(-7), d(0), 'कमी वजन, पोषण आहार आवश्यक')
  insertPatient.run('लक्ष्मी भोसले', 17, '9333333333', 'आंबेगाव', 'pregnant', 20, 'high', 1, d(-2), d(1), 'अल्पवयीन गरोदर माता, विशेष काळजी')

  // Medium-risk
  insertPatient.run('राधा काळे', 26, '9444444444', 'जुन्नर', 'pregnant', 36, 'medium', 1, d(-5), d(2), 'नियमित प्रसूतीपूर्व तपासणी आवश्यक')
  insertPatient.run('सुजाता पाटील', 28, '9555555555', 'मंचर', 'pregnant', 24, 'medium', 1, d(-10), d(3), 'आरोग्य उत्तम, नियमित पोषण आहार सुरू')
  insertPatient.run('मीना थोरात', 22, '9666666666', 'नारायणगाव', 'pregnant', 16, 'medium', 2, d(-6), d(4), 'रक्तक्षय तपासणी व गोळ्यांचे वाटप')

  // Low-risk / Healthy
  insertPatient.run('पुष्पा यादव', 30, '9777777777', 'ओतूर', 'pregnant', 12, 'low', 1, d(-14), d(7), 'पहिली प्रसूतीपूर्व तपासणी पूर्ण')
  insertPatient.run('विमल देशपांडे', 25, '9888888888', 'आंबेगाव', 'pregnant', 8, 'low', 1, d(-20), d(10), 'नियमित सोनोग्राफी सल्ला')
  insertPatient.run('अश्विनी निंबाळकर', 27, '9999999999', 'जुन्नर', 'pregnant', 30, 'low', 2, d(-4), d(5), 'टीटी इंजेक्शन व कॅल्शियम वाटप')
  insertPatient.run('छाया साळवे', 29, '9000000001', 'मंचर', 'child', null, 'low', 2, d(-8), d(6), 'बालक वय ८ महिने, लसीकरण पूर्ण')

  // More patients worker 1
  insertPatient.run('नंदा मोरे', 23, '9000000002', 'आंबेगाव', 'pregnant', 22, 'low', 1, d(-15), d(12), 'दुसरी प्रसूतीपूर्व तपासणी')
  insertPatient.run('शोभा पवार', 31, '9000000003', 'आंबेगाव', 'child', null, 'medium', 1, d(-9), d(3), 'बालक कुपोषित - अमृत आहार सुरू')
  insertPatient.run('उमा क्षीरसागर', 20, '9000000004', 'ओतूर', 'pregnant', 18, 'low', 3, d(-12), d(14), 'हिमोग्लोबिन तपासणी आवश्यक')
  insertPatient.run('कल्पना वाघमारे', 33, '9000000005', 'नारायणगाव', 'child', null, 'low', 3, d(-20), d(20), 'बालक वय १ वर्ष, नियमित वजन तपासणी')
  insertPatient.run('सोनल जगताप', 21, '9000000006', 'मंचर', 'pregnant', 34, 'medium', 4, d(-3), d(2), '३४ आठवडे गरोदर, प्रसूतीपूर्व तयारी')

  // Insert visits
  const insertVisit = db.prepare(`
    INSERT INTO visits (patient_id, worker_id, visit_date, voice_transcript, bp_systolic, bp_diastolic, weight, notes, flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertVisit.run(1, 1, d(-3), 'सविता ताईंची भेट केली. रक्तदाब जास्त आहे - 150/95. त्यांना आराम करण्यास सांगितले आणि प्राथमिक आरोग्य केंद्रात (PHC) जाण्याचा सल्ला दिला.', 150, 95, 58.5, 'उच्च रक्तदाब नोंदवला', 'HIGH_BP,HIGH_RISK')
  insertVisit.run(1, 1, d(-10), 'मागील भेट. रक्तदाब 140/90 होता.', 140, 90, 57.0, 'रक्तदाब तपासणी', 'HIGH_BP')
  insertVisit.run(2, 1, d(-7), 'अनिता ताईंची भेट. वजन कमी आहे 42 kg. पोषण आहार दिला.', null, null, 42.0, 'कमी वजन - पोषण आहार वाटप', 'UNDERWEIGHT')
  insertVisit.run(3, 1, d(-2), 'लक्ष्मी ताई - अल्पवयीन गरोदर, कुटुंबाशी सविस्तर चर्चा केली.', null, null, 51.0, 'अल्पवयीन गरोदर माता समुपदेशन', 'TEEN_PREGNANCY')
  insertVisit.run(4, 1, d(-5), 'राधा ताई - नियमित प्रसूतीपूर्व तपासणी. प्रकृती ठीक.', 120, 80, 65.0, 'नियमित तपासणी', '')
  insertVisit.run(5, 1, d(-10), 'सुजाता ताई - प्रकृती उत्तम. पुढची भेट ३ दिवसांनी.', 118, 76, 62.0, 'नियमित भेट', '')
  insertVisit.run(7, 1, d(-14), 'पुष्पा ताई - पहिली भेट. सर्व माहितीची नोंद केली.', 115, 75, 55.0, 'नोंदणी भेट', '')
  insertVisit.run(10, 2, d(-8), 'छाया ताईंचे बालक - ८ महिने वय. सर्व लसीकरण पूर्ण. वजन 7.5 kg.', null, null, 7.5, 'बालकाचे संपूर्ण लसीकरण पूर्ण', '')
  insertVisit.run(12, 1, d(-9), 'शोभा ताईंचे बालक - कुपोषित. MUAC 11.5 cm. NRC केंद्रात दाखल केले.', null, null, 8.2, 'तीव्र कुपोषण (SAM) - NRC कडे वर्ग केले', 'MALNUTRITION')

  // Insert follow-ups
  const insertFollowup = db.prepare(`
    INSERT INTO followups (patient_id, worker_id, due_date, type, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  insertFollowup.run(1, 1, d(-1), 'antenatal', 'pending', 'उच्च रक्तदाब - तातडीने भेट द्या')
  insertFollowup.run(2, 1, d(0), 'antenatal', 'pending', 'वजन व पोषण तपासणी')
  insertFollowup.run(3, 1, d(1), 'antenatal', 'pending', 'कुटुंब कल्याण समुपदेशन')
  insertFollowup.run(4, 1, d(2), 'antenatal', 'pending', 'नियमित प्रसूतीपूर्व तपासणी')
  insertFollowup.run(5, 1, d(2), 'antenatal', 'pending', 'रक्तदाब तपासणी')
  insertFollowup.run(6, 2, d(4), 'antenatal', 'pending', 'आहार व पोषण समुपदेशन')
  insertFollowup.run(7, 1, d(7), 'antenatal', 'pending', 'नियमित प्रसूतीपूर्व तपासणी')
  insertFollowup.run(10, 2, d(6), 'child_health', 'pending', 'लसीकरण - गोवर रुबेला')
  insertFollowup.run(12, 1, d(3), 'child_health', 'pending', 'पोषण पुनर्वसन केंद्र (NRC) फॉलो-अप')
  insertFollowup.run(15, 4, d(2), 'antenatal', 'pending', 'प्रसूतीपूर्व तपासणी')

  // Mark some as completed
  db.prepare("UPDATE followups SET status='completed', completed_at=? WHERE id=7").run(d(-2))
}
