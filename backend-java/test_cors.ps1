# Wake backend, wait for 200, then test CORS
Write-Host "=== Waking backend ==="
for ($i = 0; $i -lt 30; $i++) {
    $code = & curl.exe -s -o NUL -w "%{http_code}" -m 10 https://chathub-java-backend.onrender.com/api/health
    Write-Host "Wake attempt $($i+1): HTTP $code"
    if ($code -eq "200") {
        Write-Host "Backend is up! Testing CORS..."
        break
    }
    Start-Sleep -Seconds 10
}

Write-Host ""
Write-Host "=== CORS Preflight Test (OPTIONS /api/auth/login) ==="
& curl.exe -i -X OPTIONS `
    -H "Origin: https://rezimmm.github.io" `
    -H "Access-Control-Request-Method: POST" `
    -H "Access-Control-Request-Headers: Authorization,Content-Type" `
    https://chathub-java-backend.onrender.com/api/auth/login

Write-Host ""
Write-Host "=== Actual GET with Origin header (/api/health) ==="
& curl.exe -i -H "Origin: https://rezimmm.github.io" https://chathub-java-backend.onrender.com/api/health
