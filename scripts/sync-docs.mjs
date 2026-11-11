import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')
const docs = join(root, 'docs')

if (!existsSync(dist)) {
  console.error('dist/ 不存在，請先執行 npm run build')
  process.exit(1)
}

rmSync(docs, { recursive: true, force: true })
mkdirSync(docs, { recursive: true })
cpSync(dist, docs, { recursive: true })
console.log('已同步 dist → docs（供 GitHub Pages /docs 發佈）')
