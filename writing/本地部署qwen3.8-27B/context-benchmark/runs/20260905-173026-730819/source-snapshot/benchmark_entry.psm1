Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-BenchmarkPython {
    param([string]$PythonPath)
    $candidates = @()
    if ($PythonPath) { $candidates += $PythonPath }
    else {
        foreach ($name in @('python', 'python3')) {
            $command = Get-Command $name -ErrorAction SilentlyContinue
            if ($command -and $command.Source) { $candidates += $command.Source }
        }
        $candidates += (Join-Path $env:USERPROFILE '.unsloth\studio\unsloth_studio\Scripts\python.exe')
        $candidates += (Join-Path $env:USERPROFILE '.unsloth\studio\unsloth_studio\.venv\Scripts\python.exe')
        $candidates += (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
    }
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            & $candidate -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch { continue }
    }
    throw '找不到可用的 Python 3.10+。请通过 -PythonPath 指定 python.exe。'
}

function Invoke-BenchmarkSuite {
    param([string]$Mode, [System.Collections.IDictionary]$Options)
    $python = Resolve-BenchmarkPython -PythonPath $Options['PythonPath']
    $arguments = @('-u', (Join-Path $PSScriptRoot 'benchmark_suite.py'), '--mode', $Mode)
    $values = @{
        Port='--port'; ServerTimeoutSeconds='--server-timeout'; RequestTimeoutSeconds='--request-timeout'
        UnslothPath='--unsloth-path'; ModelDir='--model-dir'; OutputRoot='--output-root'
        Config='--config'; Stage='--stage'; Profiles='--profiles'; Suite='--suite'
    }
    foreach ($name in $values.Keys) {
        if (($Options.Keys -contains $name) -and $null -ne $Options[$name] -and [string]$Options[$name] -ne '') {
            $arguments += @($values[$name], [string]$Options[$name])
        }
    }
    $switches = @{
        DryRun='--dry-run'; Resume='--resume'; RetryFailed='--retry-failed'
        SkipContextCapacity='--skip-context-capacity'; WithAblations='--with-ablations'; Boundary='--boundary'
    }
    foreach ($name in $switches.Keys) {
        if (($Options.Keys -contains $name) -and $Options[$name]) { $arguments += $switches[$name] }
    }
    $previousEncoding = $env:PYTHONIOENCODING
    try {
        $env:PYTHONIOENCODING = 'utf-8'
        & $python @arguments
        return $LASTEXITCODE
    } finally { $env:PYTHONIOENCODING = $previousEncoding }
}
Export-ModuleMember -Function Invoke-BenchmarkSuite
