[CmdletBinding()]
param(
    [int]$Port = 8001,
    [int]$ServerTimeoutSeconds = 1800,
    [int]$RequestTimeoutSeconds = 7200,
    [string]$PythonPath,
    [string]$UnslothPath,
    [string]$ModelDir,
    [string]$OutputRoot,
    [string]$Config,
    [switch]$Boundary,
    [switch]$DryRun,
    [switch]$Resume,
    [switch]$RetryFailed
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:benchmarkExitCode = 1
Import-Module (Join-Path $PSScriptRoot 'benchmark_entry.psm1') -Force
Invoke-BenchmarkSuite -Mode capacity -Options $PSBoundParameters | ForEach-Object {
    if ($_ -is [int]) { $script:benchmarkExitCode = $_ } else { Write-Output $_ }
}
exit $script:benchmarkExitCode
