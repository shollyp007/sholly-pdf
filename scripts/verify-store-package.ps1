$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project = Split-Path $PSScriptRoot -Parent
$packagePath = Join-Path $project 'release\Sholly PDF 1.0.9.appx'
$archive = [IO.Compression.ZipFile]::OpenRead($packagePath)
function Read-EntryBytes($entry) {
    if ($null -eq $entry) { throw 'Missing package entry' }
    $stream = $entry.Open()
    $buffer = [IO.MemoryStream]::new()
    try { $stream.CopyTo($buffer); return ,$buffer.ToArray() }
    finally { $stream.Dispose(); $buffer.Dispose() }
}
try {
    [xml]$manifest = [Text.Encoding]::UTF8.GetString((Read-EntryBytes ($archive.GetEntry('AppxManifest.xml'))))
    if ($manifest.Package.Identity.Name -ne 'HorebDigitalNetworkInc.ShollyPDF') { throw 'Wrong identity' }
    if ($manifest.Package.Identity.Version -ne '1.0.9.0') { throw 'Wrong version' }
    if ($manifest.Package.Identity.Publisher -ne 'CN=B6D45EA1-758D-4A6E-9C72-A237EA48A487') { throw 'Wrong publisher' }
    foreach ($asset in Get-ChildItem (Join-Path $project 'build\appx') -Filter '*.png') {
        $entry = $archive.Entries | Where-Object { $_.FullName.Replace('\','/') -eq ('assets/' + $asset.Name) }
        $actual = Read-EntryBytes $entry
        $expected = [IO.File]::ReadAllBytes($asset.FullName)
        if ([Convert]::ToBase64String($actual) -ne [Convert]::ToBase64String($expected)) { throw "Icon mismatch: $($asset.Name)" }
        Write-Output "PASS packaged icon: $($asset.Name)"
    }
    Write-Output 'PASS Store identity, publisher and version 1.0.9.0'
} finally { $archive.Dispose() }
Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath
