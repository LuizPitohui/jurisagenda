# JurisAgenda — Script de inicialização
# Para o PostgreSQL local e sobe o sistema

Write-Host "Parando PostgreSQL local..." -ForegroundColor Yellow
Stop-Service -Name "postgresql*" -ErrorAction SilentlyContinue

Write-Host "Subindo JurisAgenda..." -ForegroundColor Green
docker compose up -d

Write-Host "Sistema disponivel em http://localhost" -ForegroundColor Cyan
