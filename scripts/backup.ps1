param([string]$Destination = (Join-Path $PSScriptRoot '../backups'))
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  $destinationPath = (Resolve-Path -LiteralPath $Destination).Path
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  docker compose stop crawler
  if ($LASTEXITCODE -ne 0) { throw 'Could not pause crawler' }
  docker compose exec -T db pg_dump -U miftan -d miftan -Fc -f /tmp/miftan-backup.dump
  if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
  docker compose cp db:/tmp/miftan-backup.dump "$destinationPath/$stamp.dump"
  if ($LASTEXITCODE -ne 0) { throw 'Database backup copy failed' }
  docker compose run --rm --no-deps --user root --entrypoint tar -v "${destinationPath}:/backup" crawler czf "/backup/$stamp-images.tar.gz" -C /data/images .
  if ($LASTEXITCODE -ne 0) { throw 'Image backup failed' }
  Write-Host "Backup created: $destinationPath/$stamp (protect these files; they contain listing data)."
} finally { docker compose start crawler; Pop-Location }
