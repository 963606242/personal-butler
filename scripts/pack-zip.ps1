# 将 dist-electron/win-unpacked 打成 zip，供 GitHub Release 上传
# 在项目根目录执行：npm run pack:zip

$ErrorActionPreference = "Stop"
$root = if ($PSScriptRoot) { (Resolve-Path (Join-Path $PSScriptRoot "..")).Path } else { (Get-Location).Path }
Set-Location $root

# 用 Node 读取版本号，避免 PowerShell 读 package.json 时中文编码导致 ConvertFrom-Json 失败
$version = (node -p "require('./package.json').version").Trim()
$folderName = "Personal-Butler-${version}-win-x64"
$winUnpacked = Join-Path $root "dist-electron\win-unpacked"
$outDir = Join-Path $root "dist-electron"
$zipPath = Join-Path $outDir "$folderName.zip"

if (-not (Test-Path $winUnpacked)) {
  Write-Error "未找到 dist-electron\win-unpacked，请先执行 npm run build"
  exit 1
}

$tempFolder = Join-Path $outDir $folderName
if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
Copy-Item -Recurse $winUnpacked $tempFolder

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path $tempFolder -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $tempFolder

Write-Host "已生成: $zipPath" -ForegroundColor Green
