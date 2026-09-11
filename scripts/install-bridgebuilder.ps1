# install-bridgebuilder.ps1
# Instala BridgeBuilder.pts desde la raiz del proyecto

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$bridgeBuilderPath = Join-Path (Join-Path $PSScriptRoot '..') 'BridgeBuilder.pts'

if (-not (Test-Path -LiteralPath $bridgeBuilderPath)) {
  Write-Error "No existe BridgeBuilder.pts en la raiz del proyecto: $bridgeBuilderPath"
  Write-Error "Exporta tu modulo BridgeBuilder y guardalo junto a run.ps1 antes de continuar."
  exit 1
}

Write-Output "BridgeBuilder.pts activo: $bridgeBuilderPath"
Write-Output ""
Write-Output "=== INSTRUCCIONES DE INSTALACION ==="
Write-Output "1. Abre Cisco Packet Tracer"
Write-Output "2. Ve a: Extensions > Scripting > Configure PT Script Modules"
Write-Output "3. Haz clic en 'Add...' y selecciona: $bridgeBuilderPath"
Write-Output "4. Verifica que el modulo BridgeBuilder aparece como persistente"
Write-Output "==================================="
