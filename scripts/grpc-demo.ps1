# Run while the stack is up (docker compose up -d):
#   .\scripts\grpc-demo.ps1
#   .\scripts\grpc-demo.ps1 -Species cat -Needs coat-care,low-stress
param([string]$Species = 'dog', [string[]]$Needs = @('exercise', 'companionship'))

# The real catalog from the gateway; the gRPC request carries the candidates.
$services = (Invoke-RestMethod http://localhost:3000/catalog) |
    ForEach-Object { @{ id = $_.id; species = @($_.species); tags = @($_.tags); price = $_.price } }
$json = @{ pet = @{ species = $Species; needs = @($Needs) }; services = @($services); limit = 3 } |
    ConvertTo-Json -Depth 5 -Compress

# Windows PowerShell strips unescaped double quotes from native arguments.
docker run --rm --network pet-service_default -v "$PSScriptRoot/../proto:/proto:ro" fullstorydev/grpcurl:v1.9.1 `
    -plaintext -import-path /proto -proto recommendation.proto -d ($json -replace '"', '\"') `
    recommender:50051 recommendation.RecommendationEngine/Recommend
