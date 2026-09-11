param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('ExecuteJS')]
  [string]$Action,

  [Parameter(Mandatory = $false)]
  [string]$JsCode,

  [Parameter(Mandatory = $false)]
  [string]$JsFile,

  [Parameter(Mandatory = $false)]
  [string]$ProfilePath = ".\\config\\packet-tracer-profile.json",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class NativeMouse {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
}
"@

function Invoke-Delay {
  param([int]$Ms)
  Start-Sleep -Milliseconds $Ms
}

function Invoke-LeftClick {
  param(
    [int]$X,
    [int]$Y,
    [int]$DelayMs = 200
  )

  [void][NativeMouse]::SetCursorPos($X, $Y)
  Invoke-Delay -Ms 120
  [NativeMouse]::mouse_event([NativeMouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  [NativeMouse]::mouse_event([NativeMouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
  Invoke-Delay -Ms $DelayMs
}

function Test-ActivateWindow {
  param([string[]]$Titles)

  $shell = New-Object -ComObject WScript.Shell
  foreach ($title in $Titles) {
    if ([string]::IsNullOrWhiteSpace($title)) {
      continue
    }

    try {
      if ($shell.AppActivate($title)) {
        return $true
      }
    }
    catch {
    }
  }

  return $false
}

if (-not (Test-Path -LiteralPath $ProfilePath)) {
  throw "No existe el perfil: $ProfilePath"
}

$profile = Get-Content -LiteralPath $ProfilePath -Raw | ConvertFrom-Json

if (-not $profile.PSObject.Properties.Name.Contains('builderEditorTitle')) {
  throw "Falta builderEditorTitle en el perfil."
}

if (-not $profile.PSObject.Properties.Name.Contains('windowTitle')) {
  throw "Falta windowTitle en el perfil."
}

$builderEditorTitle = [string]$profile.builderEditorTitle
$packetTracerTitle = [string]$profile.windowTitle

$focusDelay = 350
if ($profile.PSObject.Properties.Name.Contains('focusDelayMs')) {
  $focusDelay = [int]$profile.focusDelayMs
}

$afterPasteDelay = 250
if ($profile.PSObject.Properties.Name.Contains('afterPasteDelayMs')) {
  $afterPasteDelay = [int]$profile.afterPasteDelayMs
}

$afterRunDelay = 400
if ($profile.PSObject.Properties.Name.Contains('afterRunDelayMs')) {
  $afterRunDelay = [int]$profile.afterRunDelayMs
}

$runMode = 'ctrlEnter'
if ($profile.PSObject.Properties.Name.Contains('builderRunMode')) {
  $runMode = [string]$profile.builderRunMode
}

if ($Action -eq 'ExecuteJS') {

  $code = ''
  if ($JsFile -and (Test-Path -LiteralPath $JsFile)) {
    $code = Get-Content -LiteralPath $JsFile -Raw
  } elseif ($JsCode) {
    $code = $JsCode
  } else {
    throw "Debe proporcionar -JsCode o -JsFile."
  }

  if ([string]::IsNullOrWhiteSpace($code)) {
    throw "El codigo JavaScript esta vacio."
  }

  if ($DryRun) {
    Write-Output "=== CODIGO JS (dry-run) ==="
    Write-Output $code
    Write-Output "==========================="
    exit 0
  }

  # 1) Copy to clipboard
  [System.Windows.Forms.Clipboard]::SetText($code)

  # 2) Save to file as backup
  $codeFilePath = Join-Path (Split-Path $PSScriptRoot) 'config\bridge\bridgebuilder-pending.js'
  Set-Content -LiteralPath $codeFilePath -Value $code -Encoding utf8

  # 3) Focus BridgeBuilder window (or fallback to Packet Tracer)
  $builderFocused = Test-ActivateWindow -Titles @($builderEditorTitle)
  if (-not $builderFocused) {
    $ptFocused = Test-ActivateWindow -Titles @($packetTracerTitle, 'Packet Tracer', 'Cisco Packet Tracer')
    if (-not $ptFocused) {
      Write-Output '{"status":"warning","result":"No se pudo enfocar Packet Tracer/BridgeBuilder. Codigo guardado en config/bridge/bridgebuilder-pending.js"}'
      exit 0
    }

    Write-Output '{"status":"warning","result":"No se detecto BridgeBuilder enfocado. Abre Extensions > Scripting > Edit File Script Module > BridgeBuilder y reintenta."}'
    exit 0
  }

  Invoke-Delay -Ms $focusDelay

  # 4) Paste code in editor
  $shell = New-Object -ComObject WScript.Shell
  $shell.SendKeys('^a')
  Invoke-Delay -Ms 120
  $shell.SendKeys('^v')
  Invoke-Delay -Ms $afterPasteDelay

  # 5) Run code automatically
  if ($runMode -eq 'click') {
    if (-not $profile.PSObject.Properties.Name.Contains('builderRunButton')) {
      Write-Output '{"status":"warning","result":"Falta builderRunButton para modo click. Ejecuta manualmente Run."}'
      exit 0
    }

    $x = [int]$profile.builderRunButton.x
    $y = [int]$profile.builderRunButton.y
    Invoke-LeftClick -X $x -Y $y -DelayMs $afterRunDelay
  }
  else {
    # default: ctrl+enter
    $shell.SendKeys('^{ENTER}')
    Invoke-Delay -Ms $afterRunDelay
  }

  Write-Output '{"status":"success","result":"Codigo JS ejecutado en BridgeBuilder"}'
  exit 0
}

throw "Accion no soportada: $Action"
