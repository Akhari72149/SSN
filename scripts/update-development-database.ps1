$ErrorActionPreference = "Stop"

function Read-PlainTextPassword([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$databaseAdmin = Read-Host "PostgreSQL administrator username [postgres]"
if ([string]::IsNullOrWhiteSpace($databaseAdmin)) { $databaseAdmin = "postgres" }
$databasePort = Read-Host "PostgreSQL port [5432]"
if ([string]::IsNullOrWhiteSpace($databasePort)) { $databasePort = "5432" }
if ($databasePort -notmatch '^\d+$') { throw "PostgreSQL port must be a number." }
$databasePassword = Read-PlainTextPassword "PostgreSQL administrator password"

$env:SSN_DATABASE_ADMIN = $databaseAdmin
$env:SSN_DATABASE_ADMIN_PASSWORD = $databasePassword
$env:SSN_DATABASE_PORT = $databasePort
try {
  Push-Location (Join-Path $PSScriptRoot "..\web")
  try {
    & node "scripts/update-development-database.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Database update returned exit code $LASTEXITCODE." }
  }
  finally { Pop-Location }
}
finally {
  Remove-Item Env:SSN_DATABASE_ADMIN -ErrorAction SilentlyContinue
  Remove-Item Env:SSN_DATABASE_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SSN_DATABASE_PORT -ErrorAction SilentlyContinue
  $databasePassword = $null
}
