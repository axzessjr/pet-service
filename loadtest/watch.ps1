# Live view of the cluster while a test runs: gateway autoscaling, pods and their CPU.
# run.ps1 opens it in its own window; it also works on its own:
#   powershell -ExecutionPolicy Bypass -File loadtest/watch.ps1 -Queue
# -Queue adds the RabbitMQ queue the recommender reads from (events waiting, consumers).
param([switch]$Queue)

$Host.UI.RawUI.WindowTitle = 'PetBuddy cluster (namespace petbuddy)'
Set-Content (Join-Path $env:TEMP 'petbuddy-watch.pid') $PID

while ($true) {
    # Collect everything first, then redraw at once, so the screen does not flicker.
    $lines = @()
    $lines += "$(Get-Date -Format 'HH:mm:ss')   Ctrl+C to close"
    $lines += ''
    $lines += 'GATEWAY AUTOSCALING (adds a pod above 70% of its 100m CPU request, 1 to 3 pods)'
    $lines += (kubectl -n petbuddy get hpa backend 2>&1)
    $lines += ''
    $lines += 'PODS'
    $lines += (kubectl -n petbuddy get pods 2>&1)
    $lines += ''
    $lines += 'CPU AND MEMORY (metrics-server refreshes about every 15 s)'
    $lines += (kubectl -n petbuddy top pods 2>&1)
    if ($Queue) {
        $lines += ''
        $lines += 'RABBITMQ QUEUE (events waiting for the recommender)'
        $lines += 'name                          messages  consumers'
        $lines += (kubectl -n petbuddy exec rabbitmq-0 -- rabbitmqctl -q list_queues --no-table-headers name messages consumers 2>&1 |
            Where-Object { $_ -match 'recommendation' })
    }
    Clear-Host
    $lines | ForEach-Object { Write-Host $_ }
    Start-Sleep -Seconds 2
}
