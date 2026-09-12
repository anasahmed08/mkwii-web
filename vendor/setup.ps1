$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot\..
if (-not (Test-Path "vendor")) { New-Item -ItemType Directory -Path "vendor" | Out-Null }
Push-Location "vendor"
if (-not (Test-Path "wiicompiled")) {
    Write-Host "Cloning wiicompiled..." -ForegroundColor Cyan
    git clone --depth 1 https://github.com/patchzyy/Wiicompiled.git wiicompiled
}
if (-not (Test-Path "aurora")) {
    Write-Host "Cloning aurora..." -ForegroundColor Cyan
    git clone --depth 1 https://github.com/encounter/aurora.git aurora
}
Write-Host "Building translator..." -ForegroundColor Cyan
Push-Location "wiicompiled"
$csproj = Get-ChildItem -Recurse -Filter "Translator.Cli.csproj" | Select-Object -First 1
if (-not $csproj) {
    Write-Host "ERROR: Translator.Cli.csproj not found" -ForegroundColor Red
    Pop-Location; Pop-Location; Pop-Location
    exit 1
}
Write-Host "Found: $($csproj.FullName)"
& dotnet build $csproj.FullName -c Release
Pop-Location
$dll = Get-ChildItem -Path "wiicompiled" -Recurse -Filter "Translator.Cli.dll" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($dll) {
    Write-Host "Translator built: $($dll.FullName)" -ForegroundColor Green
} else {
    Write-Host "Translator DLL not found after build" -ForegroundColor Yellow
}
Pop-Location
Pop-Location