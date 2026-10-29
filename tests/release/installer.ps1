param(
  [Parameter(Mandatory = $true)][ValidateSet('Install', 'Uninstall')][string]$Action,
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$InstallDir
)
$ErrorActionPreference = 'Stop'
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.test-data')).TrimEnd('\') + '\'
$targetDir = [System.IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
if (-not $targetDir.StartsWith($testRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Installation target must stay inside .test-data.' }
$registrations = @()
# Stable NSIS identity derived by electron-builder from br.app.oceueolimite.
$appGuid = '1b125c6a-48b8-581b-8b5a-1132f3c9f194'
foreach ($base in @('HKCU:/Software', 'HKCU:/Software/WOW6432Node', 'HKLM:/Software', 'HKLM:/Software/WOW6432Node')) {
  $installKey = Join-Path $base $appGuid
  if (Test-Path -LiteralPath $installKey) { $registrations += Get-ItemProperty -LiteralPath $installKey }
  $uninstallKey = Join-Path $base "Microsoft/Windows/CurrentVersion/Uninstall/$appGuid"
  if ((Test-Path -LiteralPath $uninstallKey) -and -not (Test-Path -LiteralPath $installKey)) { throw 'Existing installation identity cannot be verified.' }
}
foreach ($entry in $registrations) {
  if (-not $entry.InstallLocation -or [System.IO.Path]::GetFullPath($entry.InstallLocation).TrimEnd('\') -ne $targetDir) { throw 'An existing personal installation must not be modified by release tests.' }
}
if ($Action -eq 'Install' -and $registrations.Count -eq 0) {
  $shortcutName = 'O C' + [char]0xe9 + 'u ' + [char]0xe9 + ' o Limite.lnk'
  foreach ($shortcut in @((Join-Path ([Environment]::GetFolderPath('Desktop')) $shortcutName), (Join-Path ([Environment]::GetFolderPath('Programs')) $shortcutName))) {
    if (Test-Path -LiteralPath $shortcut) { throw 'An existing personal shortcut must not be modified by release tests.' }
  }
}
if ($Action -eq 'Install') {
  $arguments = "/S /D=$targetDir"
} else {
  if ([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Executable)) -ne $targetDir) { throw 'Uninstaller must belong to the test directory.' }
  # Let NSIS copy itself to its normal temporary location before removing files.
  $arguments = '/S'
}
$process = Start-Process -FilePath $Executable -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $process.WaitForExit(90000)) { $process.Kill(); throw 'Installer timed out.' }
if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode)" }
if ($Action -eq 'Uninstall') {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $mainExe = Join-Path $targetDir 'O-Ceu-e-o-Limite.exe'
  while ((Test-Path -LiteralPath $mainExe) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
  if (Test-Path -LiteralPath $mainExe) { throw 'The test installation was not removed.' }
}
Write-Output "$Action completed in the isolated test directory."
