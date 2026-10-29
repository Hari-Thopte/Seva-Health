/**
 * Clean Zip Packager for Seva Health Submission
 *
 * Packages BOTH:
 *   • seva-health/   (Next.js frontend + API)
 *   • seva-reminders/ (Spring Boot SMS microservice)
 *
 * Excludes from seva-health:
 *   - .env.local (any local env file)
 *   - SQLite DB files (*.db, *.db-shm, *.db-wal)
 *   - node_modules/, .next/
 *
 * Excludes from seva-reminders:
 *   - target/  (Maven build output)
 *
 * Output: ../seva-health-clean-submission.zip
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const HEALTH_DIR = process.cwd()                                    // seva-health/
const REMINDERS_DIR = path.join(HEALTH_DIR, '..', 'seva-reminders') // seva-reminders/
const OUTPUT_ZIP = path.join(HEALTH_DIR, '..', 'seva-health-clean-submission.zip')

console.log('📦 Creating clean submission zip...')
console.log(`   seva-health:    ${HEALTH_DIR}`)
console.log(`   seva-reminders: ${REMINDERS_DIR}`)
console.log(`   output:         ${OUTPUT_ZIP}`)

const pythonScript = `
import os, zipfile

health_dir    = r"${HEALTH_DIR.replace(/\\/g, '/')}"
reminders_dir = r"${REMINDERS_DIR.replace(/\\/g, '/')}"
output_zip    = r"${OUTPUT_ZIP.replace(/\\/g, '/')}"

health_excl_dirs  = {'node_modules', '.next', '.git', '.vscode'}
health_excl_files = {'.env.local', 'seva-health.db', 'seva-health.db-shm', 'seva-health.db-wal'}
health_excl_exts  = {'.db', '.db-shm', '.db-wal', '.log'}

reminders_excl_dirs = {'target', '.git'}

count = 0
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:

    # ── seva-health ────────────────────────────────────────────────
    for dirpath, dirnames, filenames in os.walk(health_dir):
        dirnames[:] = [d for d in dirnames if d not in health_excl_dirs]
        for file in filenames:
            ext = os.path.splitext(file)[1].lower()
            if file in health_excl_files or ext in health_excl_exts:
                print(f"  [SKIP] seva-health/{file}")
                continue
            if file.startswith('.env') and file != '.env.example':
                print(f"  [SKIP] seva-health/{file}")
                continue
            full_path = os.path.join(dirpath, file)
            rel_path  = os.path.relpath(full_path, os.path.dirname(health_dir))
            zipf.write(full_path, rel_path)
            count += 1

    # ── seva-reminders ─────────────────────────────────────────────
    if os.path.isdir(reminders_dir):
        for dirpath, dirnames, filenames in os.walk(reminders_dir):
            dirnames[:] = [d for d in dirnames if d not in reminders_excl_dirs]
            for file in filenames:
                full_path = os.path.join(dirpath, file)
                rel_path  = os.path.relpath(full_path, os.path.dirname(reminders_dir))
                zipf.write(full_path, rel_path)
                count += 1
    else:
        print(f"  [WARN] seva-reminders not found at {reminders_dir} — skipping")

    # ── Root README.md ─────────────────────────────────────────────
    root_readme = os.path.join(os.path.dirname(health_dir), 'README.md')
    if os.path.isfile(root_readme):
        zipf.write(root_readme, 'README.md')
        count += 1

print(f"\\n[OK] Packaged {count} files -> {output_zip}")
`

const tmpPy = path.join(HEALTH_DIR, 'temp_packager.py')
fs.writeFileSync(tmpPy, pythonScript)
try {
  execSync('python temp_packager.py', { stdio: 'inherit' })
} finally {
  if (fs.existsSync(tmpPy)) fs.unlinkSync(tmpPy)
}
