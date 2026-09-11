param(
  [Parameter(Mandatory = $false)]
  [string]$PktFile,

  [switch]$SkipBuild,
  [switch]$NoOpenPacketTracer,

  [ValidateSet('Ask', 'Gemini', 'Copilot')]
  [string]$Assistant = 'Ask',

  [ValidateSet('Ask', 'Existing', 'New')]
  [string]$Mode = 'Ask'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Normalize-UserPathInput {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Value
  }

  $normalized = $Value.Trim()
  $normalized = $normalized -replace '^[\s''"“”‘’]+', ''
  $normalized = $normalized -replace '[\s''"“”‘’]+$', ''
  return $normalized.Trim()
}

function Try-GetClipboardPath {
  try {
    $clip = [System.Windows.Forms.Clipboard]::GetText()
    $clip = Normalize-UserPathInput -Value $clip
    if (-not [string]::IsNullOrWhiteSpace($clip)) {
      return $clip
    }
  }
  catch {
  }

  return $null
}

function Select-PktFileDialog {
  try {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'Packet Tracer (*.pkt)|*.pkt|Todos los archivos (*.*)|*.*'
    $dialog.Title = 'Selecciona un archivo .pkt'
    $dialog.Multiselect = $false
    $dialog.CheckFileExists = $true

    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      return $dialog.FileName
    }
  }
  catch {
  }

  return $null
}

function Select-ExecutableDialog {
  param(
    [string]$Title,
    [string]$Filter = 'Ejecutables (*.exe)|*.exe|Todos los archivos (*.*)|*.*'
  )

  try {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = $Filter
    $dialog.Title = $Title
    $dialog.Multiselect = $false
    $dialog.CheckFileExists = $true

    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      return $dialog.FileName
    }
  }
  catch {
  }

  return $null
}

function Show-PktStartupPicker {
  $downloadsDir = Join-Path $env:USERPROFILE 'Downloads'
  if (-not (Test-Path -LiteralPath $downloadsDir)) {
    $downloadsDir = $projectRoot
  }

  $selection = $null

  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'MCP + Packet Tracer | Seleccion de laboratorio'
  $form.StartPosition = 'CenterScreen'
  $form.Width = 980
  $form.Height = 560
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $label = New-Object System.Windows.Forms.Label
  $label.Text = "Archivos .pkt detectados en: $downloadsDir"
  $label.Left = 12
  $label.Top = 12
  $label.Width = 930
  $form.Controls.Add($label)

  $list = New-Object System.Windows.Forms.ListView
  $list.Left = 12
  $list.Top = 34
  $list.Width = 940
  $list.Height = 430
  $list.View = [System.Windows.Forms.View]::Details
  $list.FullRowSelect = $true
  $list.MultiSelect = $false
  [void]$list.Columns.Add('Nombre', 320)
  [void]$list.Columns.Add('Modificado', 170)
  [void]$list.Columns.Add('Ruta', 430)
  $form.Controls.Add($list)

  $btnRefresh = New-Object System.Windows.Forms.Button
  $btnRefresh.Text = 'Actualizar lista'
  $btnRefresh.Left = 12
  $btnRefresh.Top = 474
  $btnRefresh.Width = 120
  $form.Controls.Add($btnRefresh)

  $btnOpen = New-Object System.Windows.Forms.Button
  $btnOpen.Text = 'Abrir seleccionado'
  $btnOpen.Left = 530
  $btnOpen.Top = 474
  $btnOpen.Width = 130
  $form.Controls.Add($btnOpen)

  $btnNew = New-Object System.Windows.Forms.Button
  $btnNew.Text = 'Crear nuevo'
  $btnNew.Left = 670
  $btnNew.Top = 474
  $btnNew.Width = 120
  $form.Controls.Add($btnNew)

  $btnGeminiOnly = New-Object System.Windows.Forms.Button
  $btnGeminiOnly.Text = 'Solo Gemini'
  $btnGeminiOnly.Left = 800
  $btnGeminiOnly.Top = 474
  $btnGeminiOnly.Width = 90
  $form.Controls.Add($btnGeminiOnly)

  $btnCancel = New-Object System.Windows.Forms.Button
  $btnCancel.Text = 'Cancelar'
  $btnCancel.Left = 900
  $btnCancel.Top = 474
  $btnCancel.Width = 52
  $form.Controls.Add($btnCancel)

  $refreshList = {
    $list.Items.Clear()
    $files = Get-ChildItem -LiteralPath $downloadsDir -Filter *.pkt -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending

    foreach ($file in $files) {
      $item = New-Object System.Windows.Forms.ListViewItem($file.Name)
      [void]$item.SubItems.Add($file.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
      [void]$item.SubItems.Add($file.FullName)
      $item.Tag = $file.FullName
      [void]$list.Items.Add($item)
    }

    if ($list.Items.Count -gt 0) {
      $list.Items[0].Selected = $true
      $list.Select()
    }
  }

  $btnRefresh.Add_Click($refreshList)

  $openAction = {
    if ($list.SelectedItems.Count -eq 0) {
      [System.Windows.Forms.MessageBox]::Show('Selecciona un archivo .pkt de la lista.', 'MCP Packet Tracer', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
      return
    }

    $chosenPath = [string]$list.SelectedItems[0].Tag
    $selection = [PSCustomObject]@{
      Mode = 'Existing'
      PktFile = $chosenPath
      NoOpenPacketTracer = $false
    }
    $form.Close()
  }

  $btnOpen.Add_Click($openAction)
  $list.Add_DoubleClick($openAction)

  $btnNew.Add_Click({
    $name = [Microsoft.VisualBasic.Interaction]::InputBox('Escribe el nombre del nuevo laboratorio (sin o con .pkt):', 'Nuevo laboratorio', 'nuevo-lab')
    $name = Normalize-UserPathInput -Value $name
    if ([string]::IsNullOrWhiteSpace($name)) {
      return
    }

    if (-not $name.EndsWith('.pkt', [System.StringComparison]::OrdinalIgnoreCase)) {
      $name = "$name.pkt"
    }

    $selection = [PSCustomObject]@{
      Mode = 'New'
      PktFile = $name
      NoOpenPacketTracer = $false
    }
    $form.Close()
  })

  $btnGeminiOnly.Add_Click({
    $selection = [PSCustomObject]@{
      Mode = 'Existing'
      PktFile = $null
      NoOpenPacketTracer = $true
    }
    $form.Close()
  })

  $btnCancel.Add_Click({
    $selection = $null
    $form.Close()
  })

  & $refreshList
  [void]$form.ShowDialog()
  return $selection
}

function Get-LauncherConfigPath {
  return (Join-Path $projectRoot 'config\launcher-settings.json')
}

function Get-SavedPacketTracerExecutable {
  $configPath = Get-LauncherConfigPath
  if (-not (Test-Path -LiteralPath $configPath)) {
    return $null
  }

  try {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($null -ne $config -and -not [string]::IsNullOrWhiteSpace($config.packetTracerExe)) {
      return [string]$config.packetTracerExe
    }
  }
  catch {
    return $null
  }

  return $null
}

function Save-PacketTracerExecutable {
  param([string]$ExePath)

  $configPath = Get-LauncherConfigPath
  $configDir = Split-Path -Parent $configPath
  if (-not (Test-Path -LiteralPath $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
  }

  $json = @{
    packetTracerExe = $ExePath
  } | ConvertTo-Json -Depth 3

  Set-Content -LiteralPath $configPath -Value $json -Encoding utf8
}

function Get-PacketTracerExecutable {
  $candidates = @()

  if (-not [string]::IsNullOrWhiteSpace($env:PACKET_TRACER_EXE)) {
    $candidates += $env:PACKET_TRACER_EXE
  }

  $savedExe = Get-SavedPacketTracerExecutable
  if (-not [string]::IsNullOrWhiteSpace($savedExe)) {
    $candidates += $savedExe
  }

  $candidates += @(
    'C:\Program Files\Cisco Packet Tracer\PacketTracer.exe',
    'C:\Program Files\Cisco Packet Tracer\bin\PacketTracer.exe',
    'C:\Program Files (x86)\Cisco Packet Tracer\PacketTracer.exe',
    'C:\Program Files (x86)\Cisco Packet Tracer\bin\PacketTracer.exe'
  )

  $appPathKeys = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\PacketTracer.exe',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\PacketTracer.exe'
  )

  foreach ($key in $appPathKeys) {
    try {
      $entry = Get-ItemProperty -Path $key -ErrorAction Stop
      $defaultValue = $entry.'(default)'
      if (-not [string]::IsNullOrWhiteSpace($defaultValue)) {
        $candidates += [string]$defaultValue
      }
    }
    catch {
    }
  }

  $searchRoots = @('C:\Program Files', 'C:\Program Files (x86)')
  foreach ($root in $searchRoots) {
    if (Test-Path -LiteralPath $root) {
      try {
        $found = Get-ChildItem -LiteralPath $root -Filter PacketTracer.exe -Recurse -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty FullName -First 3
        if ($null -ne $found) {
          $candidates += $found
        }
      }
      catch {
      }
    }
  }

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $inPath = Get-Command PacketTracer.exe -ErrorAction SilentlyContinue
  if ($null -ne $inPath) {
    return $inPath.Source
  }

  throw "No encontre Packet Tracer."
}

function Request-PacketTracerExecutable {
  while ($true) {
    $manualPath = Read-Host "No se detecto Packet Tracer. Pega la ruta completa de PacketTracer.exe (o deja vacio para usar portapapeles)"
    if ([string]::IsNullOrWhiteSpace($manualPath)) {
      $manualPath = Try-GetClipboardPath
    }

    $manualPath = Normalize-UserPathInput -Value $manualPath
    if ([string]::IsNullOrWhiteSpace($manualPath)) {
      throw "No se proporciono ruta de PacketTracer.exe."
    }

    if (Test-Path -LiteralPath $manualPath) {
      $resolved = (Resolve-Path -LiteralPath $manualPath).Path
      Save-PacketTracerExecutable -ExePath $resolved
      Write-Host "Ruta guardada en config/launcher-settings.json" -ForegroundColor DarkMagenta
      return $resolved
    }

    Write-Host "Ruta invalida. Intenta nuevamente." -ForegroundColor Magenta
  }
}

function Resolve-ExistingPktPath {
  param([string]$InputPath)

  $InputPath = Normalize-UserPathInput -Value $InputPath

  if ([string]::IsNullOrWhiteSpace($InputPath)) {
    $downloadsDir = Join-Path $env:USERPROFILE 'Downloads'
    if (Test-Path -LiteralPath $downloadsDir) {
      $downloadPkts = Get-ChildItem -LiteralPath $downloadsDir -Filter *.pkt -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending

      if ($null -ne $downloadPkts -and $downloadPkts.Count -gt 0) {
        Write-Host "Archivos .pkt encontrados en Downloads:" -ForegroundColor Magenta
        for ($i = 0; $i -lt $downloadPkts.Count; $i++) {
          $f = $downloadPkts[$i]
          Write-Host ("[{0}] {1}  ({2})" -f ($i + 1), $f.Name, $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) -ForegroundColor DarkMagenta
        }

        $pick = Read-Host "Elige numero de archivo para abrir"
        if ($pick -match '^\d+$') {
          $index = [int]$pick - 1
          if ($index -ge 0 -and $index -lt $downloadPkts.Count) {
            return $downloadPkts[$index].FullName
          }
          Write-Host "Indice fuera de rango." -ForegroundColor Magenta
        }
      }
    }

    $manualPath = Read-Host "No se selecciono .pkt. Escribe la ruta de un .pkt existente (o deja vacio para usar portapapeles)"
    if ([string]::IsNullOrWhiteSpace($manualPath)) {
      $manualPath = Try-GetClipboardPath
    }
    $manualPath = Normalize-UserPathInput -Value $manualPath
    if ([string]::IsNullOrWhiteSpace($manualPath)) {
      throw "No se proporciono ruta de .pkt existente."
    }

    $InputPath = $manualPath
  }

  if ([string]::IsNullOrWhiteSpace($InputPath)) {
    throw "La ruta de .pkt esta vacia despues de normalizar."
  }

  if ([System.IO.Path]::IsPathRooted($InputPath)) {
    if (-not (Test-Path -LiteralPath $InputPath)) {
      throw "No existe el .pkt indicado: $InputPath"
    }
    return (Resolve-Path -LiteralPath $InputPath).Path
  }

  $joined = Join-Path $projectRoot $InputPath
  if (-not (Test-Path -LiteralPath $joined)) {
    throw "No existe el .pkt indicado: $joined"
  }

  return (Resolve-Path -LiteralPath $joined).Path
}

function Open-PacketTracerWithPkt {
  param([string]$PktPath)

  try {
    $packetTracerExe = Get-PacketTracerExecutable
    Start-Process -FilePath $packetTracerExe -ArgumentList ('"' + $PktPath + '"') | Out-Null
    return
  }
  catch {
    Start-Process -FilePath $PktPath | Out-Null
  }
}

function Resolve-NewPktPath {
  param([string]$InputPath)

  $downloadsDir = Join-Path $env:USERPROFILE 'Downloads'
  if (-not (Test-Path -LiteralPath $downloadsDir)) {
    $downloadsDir = $projectRoot
  }

  $selectedPath = Normalize-UserPathInput -Value $InputPath
  if ([string]::IsNullOrWhiteSpace($selectedPath)) {
    $defaultName = "nuevo-lab.pkt"
    $typed = Read-Host "Nombre del nuevo .pkt (default: $defaultName, carpeta: $downloadsDir)"
    $typed = Normalize-UserPathInput -Value $typed
    if ([string]::IsNullOrWhiteSpace($typed)) {
      $typed = $defaultName
    }

    $selectedPath = $typed
  }

  if (-not $selectedPath.EndsWith('.pkt', [System.StringComparison]::OrdinalIgnoreCase)) {
    $selectedPath = "$selectedPath.pkt"
  }

  if ([System.IO.Path]::IsPathRooted($selectedPath)) {
    return $selectedPath
  }

  return (Join-Path $downloadsDir $selectedPath)
}

function Get-StartupOptions {
  param(
    [string]$SelectedMode,
    [bool]$SelectedSkipBuild,
    [bool]$SelectedNoOpenPacketTracer,
    [string]$SelectedPktFile,
    [string]$SelectedAssistant
  )

  $geminiCmd = $null
  foreach ($name in @('gemini.cmd', 'gemini.exe', 'gemini.bat', 'gemini')) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $found) {
      $geminiCmd = $found
      break
    }
  }

  $copilotCmd = $null
  foreach ($name in @('copilot.cmd', 'copilot.exe', 'copilot.bat', 'copilot', 'github-copilot-cli.cmd', 'github-copilot-cli.exe', 'github-copilot-cli.bat', 'github-copilot-cli')) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $found) {
      $copilotCmd = $found
      break
    }
  }

  $effectiveAssistantName = 'Gemini'
  $effectiveAssistantCommand = if ($null -ne $geminiCmd) { [string]$geminiCmd.Source } else { 'gemini' }

  if ($SelectedAssistant -eq 'Gemini') {
    if ($null -eq $geminiCmd) {
      throw "Gemini CLI no esta instalado. Instalalo por favor con: npm install -g @google/gemini-cli"
    }
    $effectiveAssistantName = 'Gemini'
    $effectiveAssistantCommand = [string]$geminiCmd.Source
  }
  elseif ($SelectedAssistant -eq 'Copilot') {
    if ($null -eq $copilotCmd) {
      throw "Copilot CLI no esta instalado. Instalalo por favor con: npm install -g @githubnext/github-copilot-cli"
    }
    $effectiveAssistantName = 'Copilot'
    $effectiveAssistantCommand = [string]$copilotCmd.Source
  }
  elseif ($SelectedAssistant -ne 'Ask') {
    throw "Valor de Assistant no valido: $SelectedAssistant"
  }
  elseif ($null -eq $geminiCmd -and $null -eq $copilotCmd) {
    throw "No se encontro Gemini ni Copilot CLI. Instala uno por favor."
  }
  elseif ($null -eq $geminiCmd -and $null -ne $copilotCmd) {
    $effectiveAssistantName = 'Copilot'
    $effectiveAssistantCommand = [string]$copilotCmd.Source
  }

  Write-Host "" 
  Write-Host "===============================================" -ForegroundColor DarkMagenta
  Write-Host "   MCP PACKET TRACER // HACKER LAUNCHER" -ForegroundColor Magenta
  Write-Host "===============================================" -ForegroundColor DarkMagenta

  if ($SelectedAssistant -eq 'Ask') {
    Write-Host ""
    Write-Host "Seleccion de CLI (paso 1):" -ForegroundColor Magenta
    $geminiState = if ($null -ne $geminiCmd) { 'instalado' } else { 'no instalado' }
    $copilotState = if ($null -ne $copilotCmd) { 'instalado' } else { 'no instalado' }
    Write-Host "[1] Gemini  ($geminiState)" -ForegroundColor DarkMagenta
    Write-Host "[2] Copilot ($copilotState)" -ForegroundColor DarkMagenta

    $assistantChoice = Read-Host "Elige CLI (1/2, default 1)"
    if ([string]::IsNullOrWhiteSpace($assistantChoice)) {
      $assistantChoice = '1'
    }

    if ($assistantChoice -eq '2') {
      if ($null -eq $copilotCmd) {
        throw "Copilot CLI no esta instalado. Instalalo por favor con: npm install -g @githubnext/github-copilot-cli"
      }
      $effectiveAssistantName = 'Copilot'
      $effectiveAssistantCommand = [string]$copilotCmd.Source
    }
    else {
      if ($null -eq $geminiCmd) {
        throw "Gemini CLI no esta instalado. Instalalo por favor con: npm install -g @google/gemini-cli"
      }
      $effectiveAssistantName = 'Gemini'
      $effectiveAssistantCommand = [string]$geminiCmd.Source
    }
  }

  if ($SelectedMode -ne 'Ask') {
    return [PSCustomObject]@{
      Mode = $SelectedMode
      SkipBuild = $SelectedSkipBuild
      NoOpenPacketTracer = $SelectedNoOpenPacketTracer
      PktFile = $SelectedPktFile
      AssistantName = $effectiveAssistantName
      AssistantCommand = $effectiveAssistantCommand
    }
  }

  $downloadsDir = Join-Path $env:USERPROFILE 'Downloads'
  if (-not (Test-Path -LiteralPath $downloadsDir)) {
    $downloadsDir = $projectRoot
  }

  Write-Host "[1] Abrir .pkt de Descargas" -ForegroundColor Magenta
  Write-Host "[2] Crear .pkt nuevo" -ForegroundColor Magenta
  Write-Host "[3] Solo CLI (sin abrir Packet Tracer)" -ForegroundColor Magenta

  $choice = Read-Host "Elige opcion (1/2/3, default 1)"
  if ([string]::IsNullOrWhiteSpace($choice)) {
    $choice = '1'
  }

  $effectiveMode = 'Existing'
  $effectiveNoOpen = $false
  $effectivePktFile = $SelectedPktFile

  if ($choice -eq '2') {
    $effectiveMode = 'New'
    if ([string]::IsNullOrWhiteSpace($effectivePktFile)) {
      $effectivePktFile = Read-Host "Nombre del nuevo .pkt (sin o con extension .pkt)"
    }
  }
  elseif ($choice -eq '3') {
    $effectiveMode = 'Existing'
    $effectiveNoOpen = $true
    $effectivePktFile = $null
  }
  else {
    $pkts = Get-ChildItem -LiteralPath $downloadsDir -Filter *.pkt -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending

    if ($null -ne $pkts -and $pkts.Count -gt 0) {
      Write-Host "" 
      Write-Host "LABS EN DESCARGAS:" -ForegroundColor Magenta
      for ($i = 0; $i -lt $pkts.Count; $i++) {
        $f = $pkts[$i]
        Write-Host ("[{0}] {1}  ({2})" -f ($i + 1), $f.Name, $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) -ForegroundColor DarkMagenta
      }

      $pick = Read-Host "Selecciona numero de .pkt para abrir"
      if ($pick -match '^\d+$') {
        $index = [int]$pick - 1
        if ($index -ge 0 -and $index -lt $pkts.Count) {
          $effectivePktFile = $pkts[$index].FullName
        }
      }
    }

    if ([string]::IsNullOrWhiteSpace($effectivePktFile)) {
      $effectivePktFile = Read-Host "No se eligio un indice valido. Pega ruta de .pkt (ENTER para usar portapapeles)"
      if ([string]::IsNullOrWhiteSpace($effectivePktFile)) {
        $effectivePktFile = Try-GetClipboardPath
      }
    }
  }

  $compileChoice = Read-Host "Compilar servidor MCP antes de iniciar? (S/N, default S)"
  $effectiveSkipBuild = $SelectedSkipBuild
  if ($compileChoice -match '^[Nn]$') {
    $effectiveSkipBuild = $true
  }

  return [PSCustomObject]@{
    Mode = $effectiveMode
    SkipBuild = $effectiveSkipBuild
    NoOpenPacketTracer = $effectiveNoOpen
    PktFile = $effectivePktFile
    AssistantName = $effectiveAssistantName
    AssistantCommand = $effectiveAssistantCommand
  }
}

function Set-PacketTracerWindowFocus {
  param(
    [int]$ProcessId,
    [string[]]$WindowTitles
  )

  $shell = New-Object -ComObject WScript.Shell

  if ($ProcessId -gt 0) {
    try {
      if ($shell.AppActivate($ProcessId)) {
        return $true
      }
    }
    catch {
    }
  }

  foreach ($title in $WindowTitles) {
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

function New-PacketTracerFile {
  param(
    [string]$TargetPath,
    [string]$PacketTracerExe
  )

  Write-Host "[2/3] Creando nuevo .pkt: $TargetPath" -ForegroundColor Magenta
  $ptProcess = Start-Process -FilePath $PacketTracerExe -PassThru
  Start-Sleep -Milliseconds 1800

  $focused = Set-PacketTracerWindowFocus -ProcessId $ptProcess.Id -WindowTitles @('Cisco Packet Tracer', 'Packet Tracer')
  if (-not $focused) {
    Write-Warning "No se pudo enfocar la ventana automaticamente. Si no se guarda el .pkt, guardalo manualmente en Packet Tracer."
  }

  $shell = New-Object -ComObject WScript.Shell
  if ($focused) {
    $shell.SendKeys('^n')
    Start-Sleep -Milliseconds 350
    $shell.SendKeys('^s')
    Start-Sleep -Milliseconds 700
    $shell.SendKeys($TargetPath)
    Start-Sleep -Milliseconds 200
    $shell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 900
  }

  if (-not (Test-Path -LiteralPath $TargetPath)) {
    Write-Warning "No pude confirmar en disco el archivo .pkt. Verifica si Packet Tracer abrio un dialogo adicional y guarda manualmente si hace falta."
  }

  return $TargetPath
}

function Get-BridgeStatusQuick {
  $url = 'http://127.0.0.1:54321/status'
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($response.Content)) {
      return $response.Content
    }
  }
  catch {
  }

  return $null
}

function Ensure-McpServerRunning {
  $alreadyRunning = $false
  try {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop
    foreach ($proc in $processes) {
      $cmd = [string]$proc.CommandLine
      if ([string]::IsNullOrWhiteSpace($cmd)) {
        continue
      }

      if ($cmd -like '*dist/index.js*') {
        $alreadyRunning = $true
        break
      }
    }
  }
  catch {
  }

  if ($alreadyRunning) {
    Write-Host "MCP server ya esta ejecutandose." -ForegroundColor DarkMagenta
    return
  }

  Write-Host "Iniciando MCP server automaticamente..." -ForegroundColor Magenta
  $env:PT_MCP_OWNER_PID = "$PID"
  Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
  Start-Sleep -Milliseconds 500
}

function Get-AssistantInvocationForCmd {
  param([string]$AssistantCommand)

  if ([string]::IsNullOrWhiteSpace($AssistantCommand)) {
    throw "Comando de asistente vacio."
  }

  $cmdCommand = $AssistantCommand
  if ($cmdCommand.EndsWith('.ps1', [System.StringComparison]::OrdinalIgnoreCase)) {
    $cmdSibling = [System.IO.Path]::ChangeExtension($cmdCommand, '.cmd')
    $batSibling = [System.IO.Path]::ChangeExtension($cmdCommand, '.bat')

    if (Test-Path -LiteralPath $cmdSibling) {
      $cmdCommand = $cmdSibling
    }
    elseif (Test-Path -LiteralPath $batSibling) {
      $cmdCommand = $batSibling
    }
    else {
      $escapedPs1 = $cmdCommand.Replace('"', '""')
      return "powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$escapedPs1`""
    }
  }

  $escaped = $cmdCommand.Replace('"', '""')
  return "`"$escaped`""
}

function Start-AssistantInCmd {
  param(
    [string]$AssistantName,
    [string]$AssistantCommand
  )

  $invocation = Get-AssistantInvocationForCmd -AssistantCommand $AssistantCommand
  $escapedProjectRoot = $projectRoot.Replace('"', '""')
  $cmdLine = "title MCP Packet Tracer - $AssistantName && cd /d `"$escapedProjectRoot`""
  $startupPrompt = "Usa el archivo context_md/prompt-rapido-pt.md como instrucciones base de velocidad para esta sesion y cumplalo estrictamente."
  $escapedStartupPrompt = $startupPrompt.Replace('"', '""')

  if ($AssistantName -eq 'Copilot') {
    $copilotLaunch = "$invocation --add-dir `"$escapedProjectRoot`""
    $mcpConfigPath = Join-Path $projectRoot 'config\copilot-mcp-config.json'
    if (Test-Path -LiteralPath $mcpConfigPath) {
      $escapedMcpConfigPath = $mcpConfigPath.Replace('"', '""')
      $copilotLaunch = "$copilotLaunch --additional-mcp-config `"@$escapedMcpConfigPath`""
    }

    $cmdLine = $cmdLine + " && doskey copilot=$copilotLaunch `$* && doskey github-copilot-cli=$copilotLaunch `$*"
    $cmdLine = $cmdLine + " && echo. && echo Iniciando Copilot CLI interactivo con MCP del proyecto... && echo. && $copilotLaunch -i `"$escapedStartupPrompt`""
  }
  else {
    $cmdLine = $cmdLine + " && $invocation --prompt-interactive `"$escapedStartupPrompt`""
  }

  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $cmdLine | Out-Null
}

try {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm no esta disponible en PATH. Instala Node.js antes de continuar."
  }

  $startupOptions = Get-StartupOptions `
    -SelectedMode $Mode `
    -SelectedSkipBuild ([bool]$SkipBuild) `
    -SelectedNoOpenPacketTracer ([bool]$NoOpenPacketTracer) `
    -SelectedPktFile $PktFile `
    -SelectedAssistant $Assistant

  $effectivePktFile = $PktFile
  if ([string]::IsNullOrWhiteSpace($effectivePktFile) -and -not [string]::IsNullOrWhiteSpace($startupOptions.PktFile)) {
    $effectivePktFile = [string]$startupOptions.PktFile
  }

  if (-not $startupOptions.SkipBuild) {
    Write-Host "[1/4] Compilando servidor MCP..." -ForegroundColor Magenta
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo la compilacion del proyecto MCP."
    }
  }
  else {
    Write-Host "[1/4] Compilacion omitida (-SkipBuild)." -ForegroundColor DarkMagenta
  }

  Write-Host "[2/4] Arrancando MCP server automatico..." -ForegroundColor Magenta
  Ensure-McpServerRunning

  if (-not $startupOptions.NoOpenPacketTracer) {
    if ($startupOptions.Mode -eq 'Existing') {
      $resolvedPkt = Resolve-ExistingPktPath -InputPath $effectivePktFile
      Write-Host "[3/4] Abriendo Packet Tracer con el .pkt seleccionado: $resolvedPkt" -ForegroundColor Magenta
      Open-PacketTracerWithPkt -PktPath $resolvedPkt
      Start-Sleep -Milliseconds 700
    }
    else {
      try {
        $packetTracerExe = Get-PacketTracerExecutable
      }
      catch {
        $packetTracerExe = Request-PacketTracerExecutable
      }

      $newPktPath = Resolve-NewPktPath -InputPath $effectivePktFile
      New-PacketTracerFile -TargetPath $newPktPath -PacketTracerExe $packetTracerExe | Out-Null
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor DarkMagenta
    Write-Host "  Abre en Packet Tracer:" -ForegroundColor Magenta
    Write-Host "  Extensions > Scripting > Edit File Script Module > BridgeBuilder" -ForegroundColor DarkMagenta
    Write-Host "  (dejalo abierto para las topologias)" -ForegroundColor Magenta
    Write-Host "============================================" -ForegroundColor DarkMagenta
    Write-Host ""
    Write-Host "Continuando automaticamente sin pausa..." -ForegroundColor DarkMagenta
    Start-Sleep -Milliseconds 700
  }
  else {
    Write-Host "[3/4] Apertura de Packet Tracer omitida (-NoOpenPacketTracer)." -ForegroundColor DarkMagenta
  }

  Write-Host "[4/4] Iniciando $($startupOptions.AssistantName) CLI en CMD..." -ForegroundColor Magenta
  $bridgeStatus = Get-BridgeStatusQuick
  if ($null -ne $bridgeStatus) {
    Write-Host "Bridge status actual: $bridgeStatus" -ForegroundColor DarkMagenta
  }
  else {
    Write-Host "Bridge status actual: no disponible aun (normal si MCP aun no inicia)." -ForegroundColor DarkMagenta
  }
  Write-Host "Tip: pide crear topologias en lenguaje natural. Ejemplo: 'Crea 2 routers con una PC cada uno'" -ForegroundColor DarkMagenta
  Write-Host "Tip Bridge: primero invoca pt_bridge_autoconnect con {\"dryRun\": false} y luego pt_bridge_status." -ForegroundColor DarkMagenta
  Start-AssistantInCmd -AssistantName $startupOptions.AssistantName -AssistantCommand $startupOptions.AssistantCommand
}
catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Magenta
  Write-Host "Presiona ENTER para cerrar..." -ForegroundColor DarkMagenta
  [void](Read-Host)
  exit 1
}
