$envFile = Get-Content ".env"
foreach ($line in $envFile) {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split("=", 2)
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

# Override to use local Docker services
[System.Environment]::SetEnvironmentVariable("REDIS_URL", "redis://localhost:6379")
[System.Environment]::SetEnvironmentVariable("MONGO_URL", "mongodb://localhost:27017")
Write-Host "Set REDIS_URL to redis://localhost:6379"
Write-Host "Set MONGO_URL to mongodb://localhost:27017"

& 'C:\Program Files\JetBrains\IntelliJ IDEA 2025.1.3\plugins\maven\lib\maven3\bin\mvn.cmd' spring-boot:run
