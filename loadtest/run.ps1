# Runs the k6 journey against the local cluster and samples pod CPU and the HPA while it runs.
# From the repo root:
#   powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile load
#   powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile stress -Name stress-2
# Needs loadtest/secrets.env (copy secrets.env.example; git ignores it) with the k6 account.
# Results land in loadtest/results/<Name>: summary.json, k6-output.txt, k8s-samples.csv, raw.csv.gz.
# k6's exit code 99 means a threshold failed: that is a test result, not a broken run.
# -OneGatewayPod holds the gateway at one pod (HPA min = max = 1) for the run and puts the
# HPA back afterwards: the baseline that the Scalability QA compares autoscaling against.
# While k6 runs, its live dashboard opens in the browser (http://localhost:5665) and a second
# window shows the pods and the HPA; the dashboard is saved as report.html at the end.
# -NoDashboard turns both off.
param(
    [Parameter(Mandatory = $true)][ValidateSet('load', 'stress', 'spike')][string]$Profile,
    [string]$Name = $Profile,
    [switch]$OneGatewayPod,
    [switch]$NoDashboard
)

if ((kubectl config current-context) -ne 'docker-desktop') {
    throw 'kubectl is not on docker-desktop; refusing to run.'
}
$envFile = Join-Path $PSScriptRoot 'secrets.env'
if (-not (Test-Path $envFile)) {
    throw "Missing $envFile (copy secrets.env.example and fill in the k6 account)."
}

# Every run starts from one gateway pod, so runs are comparable. After a run the HPA
# needs about a minute of low load to scale back in.
$deadline = (Get-Date).AddMinutes(6)
while ([int](kubectl -n petbuddy get deploy backend -o jsonpath='{.status.replicas}') -ne 1) {
    if ((Get-Date) -gt $deadline) { throw 'The gateway did not scale back to one pod.' }
    Write-Output 'Waiting for the gateway to scale back to one pod...'
    Start-Sleep -Seconds 15
}

$hpaPatch = Join-Path $env:TEMP 'petbuddy-hpa-patch.json'
$hpaOriginal = $null
if ($OneGatewayPod) {
    $hpaOriginal = -split (kubectl -n petbuddy get hpa backend -o jsonpath='{.spec.minReplicas} {.spec.maxReplicas}')
    '{"spec":{"minReplicas":1,"maxReplicas":1}}' | Set-Content $hpaPatch -Encoding ascii
    kubectl -n petbuddy patch hpa backend --type merge --patch-file $hpaPatch | Out-Null
    Write-Output "Gateway held at one pod for this run (HPA was $($hpaOriginal[0])-$($hpaOriginal[1]))."
}

# Keeps Windows awake until this script exits: Modern Standby once froze a run halfway.
# 2147483651 = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED. Closing the lid still sleeps.
Add-Type -Namespace Native -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
[void][Native.Power]::SetThreadExecutionState([uint32]2147483651)

$out = Join-Path $PSScriptRoot "results/$Name"
# A rerun under the same name replaces the earlier results.
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $out | Out-Null
$samplesFile = Join-Path $out 'k8s-samples.csv'

# Long format, so a new pod during the test needs no new column. Unix time in seconds,
# so summarize.py can line the samples up with k6's own timestamps.
$sampler = Start-Job -ArgumentList $samplesFile -ScriptBlock {
    param($file)
    'epoch_s,kind,name,value' | Set-Content $file -Encoding ascii
    while ($true) {
        $t = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $lines = @()
        foreach ($row in (kubectl -n petbuddy top pods --no-headers)) {
            $p = -split $row
            $lines += "$t,cpu_m,$($p[0]),$($p[1] -replace 'm','')"
            $lines += "$t,mem_mi,$($p[0]),$($p[2] -replace 'Mi','')"
        }
        $hpa = -split (kubectl -n petbuddy get hpa backend -o jsonpath='{.status.currentReplicas} {.status.desiredReplicas} {.status.currentMetrics[0].resource.current.averageUtilization}')
        $lines += "$t,replicas,backend,$($hpa[0])"
        $lines += "$t,desired_replicas,backend,$($hpa[1])"
        $lines += "$t,hpa_cpu_pct,backend,$($hpa[2])"
        foreach ($d in 'backend', 'recommender') {
            $ready = kubectl -n petbuddy get deploy $d -o jsonpath='{.status.readyReplicas}'
            $lines += "$t,ready_pods,$d,$(if ($ready) { $ready } else { 0 })"
        }
        $lines | Add-Content $file -Encoding ascii
        Start-Sleep -Seconds 5
    }
}

$dashboardArgs = @()
$opener = $null
$proxy = $null
$stopper = $null
if (-not $NoDashboard) {
    # The browser reaches k6 through dashboard-proxy.mjs (5665 -> 5666). k6 waits for the
    # browser to let go of the dashboard before it writes summary.json and exits, so the
    # proxy is stopped as soon as the report is exported.
    $proxy = Start-Process node -ArgumentList (Join-Path $PSScriptRoot 'dashboard-proxy.mjs'), '5666', '5665' -WindowStyle Hidden -PassThru
    $stopper = Start-Job -ArgumentList (Join-Path $out 'report.html'), $proxy.Id -ScriptBlock {
        param($report, $proxyId)
        while (-not (Test-Path $report)) { Start-Sleep -Seconds 1 }
        Start-Sleep -Seconds 2
        Stop-Process -Id $proxyId -ErrorAction SilentlyContinue
    }
    $dashboardArgs = @(
        '-p', '5666:5665',
        '-e', 'K6_WEB_DASHBOARD=true',
        '-e', 'K6_WEB_DASHBOARD_HOST=0.0.0.0',
        '-e', 'K6_WEB_DASHBOARD_PERIOD=2s',
        '-e', "K6_WEB_DASHBOARD_EXPORT=/loadtest/results/$Name/report.html"
    )
    # One cluster window is enough: reuse it if an earlier run opened it.
    $watchPid = Get-Content (Join-Path $env:TEMP 'petbuddy-watch.pid') -ErrorAction SilentlyContinue
    if (-not ($watchPid -and (Get-Process -Id $watchPid -ErrorAction SilentlyContinue))) {
        Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'watch.ps1')
    }
    # Opens the browser as soon as k6 serves the dashboard (after setup() has warmed up).
    $opener = Start-Job -ScriptBlock {
        for ($i = 0; $i -lt 120; $i++) {
            try {
                Invoke-WebRequest 'http://localhost:5665/' -UseBasicParsing -TimeoutSec 1 | Out-Null
                Start-Process 'http://localhost:5665/'
                return
            }
            catch { Start-Sleep -Seconds 1 }
        }
    }
    Write-Output "k6 dashboard: http://localhost:5665 (live), saved afterwards to results/$Name/report.html"
}

try {
    # The account goes in as container env (not on the command line); k6 run reads it.
    docker run --rm @dashboardArgs -v "${PSScriptRoot}:/loadtest" --env-file $envFile `
        -e 'K6_CSV_TIME_FORMAT=unix_milli' `
        grafana/k6:1.0.0 run --no-color --quiet -e "PROFILE=$Profile" `
        -e 'BASE_URL=http://host.docker.internal:8080' `
        --summary-export "/loadtest/results/$Name/summary.json" `
        --out "csv=/loadtest/results/$Name/raw.csv.gz" `
        /loadtest/k6/journey.js | Tee-Object -FilePath (Join-Path $out 'k6-output.txt')
    Write-Output "k6 exit code: $LASTEXITCODE"
}
finally {
    Stop-Job $sampler
    Remove-Job $sampler -Force
    if ($opener) { Remove-Job $opener -Force }
    if ($stopper) { Remove-Job $stopper -Force }
    if ($proxy) { Stop-Process -Id $proxy.Id -ErrorAction SilentlyContinue }
    if ($hpaOriginal) {
        "{`"spec`":{`"minReplicas`":$($hpaOriginal[0]),`"maxReplicas`":$($hpaOriginal[1])}}" | Set-Content $hpaPatch -Encoding ascii
        kubectl -n petbuddy patch hpa backend --type merge --patch-file $hpaPatch | Out-Null
        Remove-Item $hpaPatch -ErrorAction SilentlyContinue
        Write-Output "HPA restored to $($hpaOriginal[0])-$($hpaOriginal[1]) pods."
    }
}
