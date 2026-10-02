param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('decision', 'error', 'done')]
  [string]$Name
)
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot "$Name.wav"
if (-not (Test-Path -LiteralPath $path)) { exit 1 }
(New-Object System.Media.SoundPlayer -ArgumentList $path).PlaySync()
