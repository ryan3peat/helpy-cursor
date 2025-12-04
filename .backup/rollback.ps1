# Rollback script for invitation link changes (Option 2)
# Run this script to restore the original files

Write-Host "Rolling back invitation link changes..." -ForegroundColor Yellow

# Restore InviteWelcome.tsx
if (Test-Path ".backup\InviteWelcome.tsx.backup") {
    Copy-Item ".backup\InviteWelcome.tsx.backup" "components\InviteWelcome.tsx" -Force
    Write-Host "✓ Restored InviteWelcome.tsx" -ForegroundColor Green
} else {
    Write-Host "✗ Backup file not found: .backup\InviteWelcome.tsx.backup" -ForegroundColor Red
}

# Restore SignUp.tsx
if (Test-Path ".backup\SignUp.tsx.backup") {
    Copy-Item ".backup\SignUp.tsx.backup" "components\SignUp.tsx" -Force
    Write-Host "✓ Restored SignUp.tsx" -ForegroundColor Green
} else {
    Write-Host "✗ Backup file not found: .backup\SignUp.tsx.backup" -ForegroundColor Red
}

# Restore Auth.tsx
if (Test-Path ".backup\Auth.tsx.backup") {
    Copy-Item ".backup\Auth.tsx.backup" "components\Auth.tsx" -Force
    Write-Host "✓ Restored Auth.tsx" -ForegroundColor Green
} else {
    Write-Host "✗ Backup file not found: .backup\Auth.tsx.backup" -ForegroundColor Red
}

# Restore App.tsx
if (Test-Path ".backup\App.tsx.backup") {
    Copy-Item ".backup\App.tsx.backup" "App.tsx" -Force
    Write-Host "✓ Restored App.tsx" -ForegroundColor Green
} else {
    Write-Host "✗ Backup file not found: .backup\App.tsx.backup" -ForegroundColor Red
}

Write-Host "`nRollback complete!" -ForegroundColor Green
Write-Host "Please restart your development server if it's running." -ForegroundColor Yellow

