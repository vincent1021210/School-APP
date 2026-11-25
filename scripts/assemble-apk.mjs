import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const android = join(process.cwd(), 'android')
const isWin = process.platform === 'win32'
const cmd = isWin ? 'gradlew.bat' : './gradlew'
const result = spawnSync(cmd, ['assembleDebug', '--no-daemon'], {
  cwd: android,
  stdio: 'inherit',
  shell: isWin,
})
process.exit(result.status ?? 1)
