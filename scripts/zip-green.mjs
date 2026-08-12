import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
const version = pkg.version || '1.0.0'
const appName = pkg.productName || '弓箭性能分析计算工具'

const releaseRoot = 'D:/dev/DFC-release'
const unpacked = path.join(releaseRoot, 'win-unpacked')
const stageName = appName
const staged = path.join(releaseRoot, stageName)

/** Usage: node scripts/zip-green.mjs [zipName]  or  ZIP_NAME=xxx node scripts/zip-green.mjs */
function resolveZipName() {
  const fromArg = process.argv.slice(2).find((a) => a && !a.startsWith('-'))
  const fromEnv = process.env.ZIP_NAME?.trim()
  let name = (fromArg || fromEnv || `${appName}-${version}-绿色版`).trim()
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  if (!name.toLowerCase().endsWith('.zip')) name += '.zip'
  return name
}

const zipFileName = resolveZipName()
const outZip = path.join(releaseRoot, zipFileName)

if (!existsSync(unpacked)) {
  console.error('missing win-unpacked, run electron-builder --win dir first')
  process.exit(1)
}

// Stage a clean folder name, then zip it so customers see the right exe name after extract
if (existsSync(staged)) rmSync(staged, { recursive: true, force: true })
if (existsSync(outZip)) rmSync(outZip, { force: true })

execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    [
      `$src = '${unpacked.replaceAll("'", "''")}'`,
      `$dst = '${staged.replaceAll("'", "''")}'`,
      `$zip = '${outZip.replaceAll("'", "''")}'`,
      'New-Item -ItemType Directory -Force -Path $dst | Out-Null',
      'Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force',
      'if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }',
      'Compress-Archive -Path $dst -DestinationPath $zip -Force',
      'Remove-Item -LiteralPath $dst -Recurse -Force',
      'Write-Host "created $zip"',
    ].join('; '),
  ],
  { stdio: 'inherit' },
)

console.log(`zip 文件名：${zipFileName}`)
console.log(`客户：解压 zip → 打开「${appName}」文件夹 → 双击「${appName}.exe」`)
console.log('该 exe 图标与 win-unpacked 内一致（弓箭图标）')
