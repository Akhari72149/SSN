$ErrorActionPreference = "Stop"

function Read-PlainTextPassword([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$databaseAdmin = Read-Host "PostgreSQL administrator username [postgres]"
if ([string]::IsNullOrWhiteSpace($databaseAdmin)) { $databaseAdmin = "postgres" }
$databasePort = Read-Host "PostgreSQL port [5432]"
if ([string]::IsNullOrWhiteSpace($databasePort)) { $databasePort = "5432" }
if ($databasePort -notmatch '^\d+$') { throw "PostgreSQL port must be a number." }
$databasePassword = Read-PlainTextPassword "PostgreSQL administrator password"
$adminUsername = Read-Host "Initial Safer Spaces administrator username (spaces are allowed)"
$adminName = Read-Host "Initial Safer Spaces administrator display name"
$adminPassword = Read-PlainTextPassword "Initial Safer Spaces administrator password (at least 14 characters)"
$confirmPassword = Read-PlainTextPassword "Confirm Safer Spaces administrator password"

if ([string]::IsNullOrWhiteSpace($adminUsername) -or [string]::IsNullOrWhiteSpace($adminName)) {
  throw "Administrator username and display name are required."
}
if ($adminPassword.Length -lt 14) {
  throw "The administrator password must be at least 14 characters."
}
if ($adminPassword -cne $confirmPassword) {
  throw "The administrator passwords do not match."
}

$env:BOOTSTRAP_ADMIN_USERNAME = $adminUsername
$env:BOOTSTRAP_ADMIN_NAME = $adminName
$env:BOOTSTRAP_ADMIN_PASSWORD = $adminPassword
$env:SSN_DATABASE_ADMIN = $databaseAdmin
$env:SSN_DATABASE_ADMIN_PASSWORD = $databasePassword
$env:SSN_DATABASE_PORT = $databasePort

try {
  Push-Location (Join-Path $PSScriptRoot "..\web")
  try {
    & node "scripts/setup-development.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Development setup returned exit code $LASTEXITCODE." }
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_ADMIN_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SSN_DATABASE_ADMIN -ErrorAction SilentlyContinue
  Remove-Item Env:SSN_DATABASE_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SSN_DATABASE_PORT -ErrorAction SilentlyContinue
  $databasePassword = $null
  $adminPassword = $null
  $confirmPassword = $null
}
