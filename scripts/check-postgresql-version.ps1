$ErrorActionPreference = "Stop"

function Find-PostgresClients {
  $paths = @()
  $command = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($command) { $paths += $command.Source }

  $postgresRoot = Join-Path $env:ProgramFiles "PostgreSQL"
  if (Test-Path -LiteralPath $postgresRoot) {
    $paths += Get-ChildItem -LiteralPath $postgresRoot -Directory |
      ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
      Where-Object { Test-Path -LiteralPath $_ }
  }

  return $paths | Sort-Object -Unique
}

function Read-PlainTextPassword([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$clients = @(Find-PostgresClients)
if ($clients.Count -eq 0) {
  Write-Host "No PostgreSQL command-line tools were found." -ForegroundColor Red
  Write-Host "Install PostgreSQL 16 for Windows and include Command Line Tools."
  exit 1
}

Write-Host "Installed PostgreSQL command-line clients:" -ForegroundColor Cyan
foreach ($client in $clients) {
  $clientVersion = & $client --version
  Write-Host "  $clientVersion"
  Write-Host "  $client"
}

$services = @(Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue)
if ($services.Count -gt 0) {
  Write-Host "`nPostgreSQL Windows services:" -ForegroundColor Cyan
  foreach ($service in $services) {
    Write-Host "  $($service.Name) - $($service.Status)"
  }
}

$databaseAdmin = Read-Host "`nPostgreSQL administrator username [postgres]"
if ([string]::IsNullOrWhiteSpace($databaseAdmin)) { $databaseAdmin = "postgres" }
$databasePort = Read-Host "PostgreSQL port [5432]"
if ([string]::IsNullOrWhiteSpace($databasePort)) { $databasePort = "5432" }
if ($databasePort -notmatch '^\d+$') { throw "PostgreSQL port must be a number." }
$databasePassword = Read-PlainTextPassword "PostgreSQL administrator password"
$selectedClient = $clients | Sort-Object { [version](([regex]::Match((& $_ --version), '\d+(\.\d+)+')).Value) } -Descending | Select-Object -First 1

$env:PGPASSWORD = $databasePassword
try {
  $serverVersion = & $selectedClient -X -h 127.0.0.1 -p $databasePort -U $databaseAdmin -d postgres -tAc "show server_version" 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($serverVersion -join "`n") }
  $serverVersionNumber = & $selectedClient -X -h 127.0.0.1 -p $databasePort -U $databaseAdmin -d postgres -tAc "show server_version_num" 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($serverVersionNumber -join "`n") }
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $databasePassword = $null
}

$serverVersion = ($serverVersion | Select-Object -First 1).Trim()
$serverVersionNumber = [int](($serverVersionNumber | Select-Object -First 1).Trim())
$serverMajor = [math]::Floor($serverVersionNumber / 10000)

Write-Host "`nRunning PostgreSQL server: $serverVersion" -ForegroundColor Cyan
if ($serverMajor -eq 16) {
  Write-Host "Compatible: the running server is PostgreSQL 16." -ForegroundColor Green
  exit 0
}

Write-Host "Not compatible with the agreed development baseline: PostgreSQL 16 is required." -ForegroundColor Red
exit 2
