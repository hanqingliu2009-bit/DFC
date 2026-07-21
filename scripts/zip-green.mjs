import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const releaseRoot = 'D:/dev/DFC-release'
const unpacked = path.join(releaseRoot, 'win-unpacked')
const stageName = 'DFC拉力曲线'
const staged = path.join(releaseRoot, stageName)
const outZip = path.join(releaseRoot, 'DFC拉力曲线-1.0.0-绿色版.zip')

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

console.log('客户：解压 zip → 打开「DFC拉力曲线」文件夹 → 双击「DFC拉力曲线.exe」')
console.log('该 exe 图标与 win-unpacked 内一致（弓箭图标）')
