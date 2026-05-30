for ($i = 0; $i -lt 20; $i++) {
    $code = & curl.exe -s -o NUL -w "%{http_code}" -m 10 https://chathub-java-backend.onrender.com/api/health
    Write-Host "Attempt $($i+1): HTTP $code"
    if ($code -eq "200") {
        Write-Host "BACKEND IS UP!"
        break
    }
    Start-Sleep -Seconds 15
}
