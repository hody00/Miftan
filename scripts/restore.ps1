param([Parameter(Mandatory=$true)][string]$DatabaseDump,[Parameter(Mandatory=$true)][string]$ImageArchive,[switch]$ConfirmReplace)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmReplace) { throw 'Restore replaces the Miftan database. Create a backup first, then pass -ConfirmReplace.' }
$dump = (Resolve-Path -LiteralPath $DatabaseDump).Path
$images = (Resolve-Path -LiteralPath $ImageArchive).Path
Push-Location (Join-Path $PSScriptRoot '..')
try {
  docker compose stop web crawler
  if ($LASTEXITCODE -ne 0) { throw 'Could not stop application services' }
  docker compose cp $dump db:/tmp/miftan-restore.dump
  if ($LASTEXITCODE -ne 0) { throw 'Could not copy backup' }
  docker compose exec -T db pg_restore -U miftan -d miftan --clean --if-exists --no-owner --exit-on-error /tmp/miftan-restore.dump
  if ($LASTEXITCODE -ne 0) { throw 'Database restore failed; services remain stopped' }
  docker compose run --rm --no-deps --user root --entrypoint sh -v "${images}:/backup/images.tar.gz:ro" crawler -c 'tar xzf /backup/images.tar.gz -C /data/images && chown -R pwuser:pwuser /data/images'
  if ($LASTEXITCODE -ne 0) { throw 'Image restore failed; services remain stopped' }
  docker compose up -d web crawler
  if ($LASTEXITCODE -ne 0) { throw 'Services failed to restart' }
} finally { Pop-Location }
