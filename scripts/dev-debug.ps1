# Lance l'app en mode dev avec le port de débogage WebView2 ouvert (CDP sur localhost:9222).
# Usage : .\scripts\dev-debug.ps1   (à lancer en arrière-plan depuis Claude Code)
# Ensuite, le plugin chrome-devtools peut se connecter à http://localhost:9222.
param([int]$Port = 9222)

# Les shells ouverts avant l'installation de rustup n'ont pas ~/.cargo/bin dans leur PATH.
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (-not (Get-Command cargo -ErrorAction SilentlyContinue) -and (Test-Path $cargoBin)) {
    $env:PATH = "$cargoBin;$env:PATH"
}

$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
Set-Location (Join-Path $PSScriptRoot "..")
pnpm tauri dev
