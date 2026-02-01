---
description: Automatically sync local changes to GitHub
---

This workflow automates the process of staging, committing, and pushing changes to the GitHub repository.

### Steps:

1. **Stage all changes**
   ```powershell
   git add .
   ```

2. **Commit changes**
   // turbo
   ```powershell
   git commit -m "Automated update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
   ```

3. **Push to GitHub**
   // turbo
   ```powershell
   git push origin main
   ```

### Troubleshooting:
If you see a "Permission denied" or "403" error, it means you need to update your GitHub credentials.
Run this command to clear old credentials and try again:
```powershell
git config --global --unset credential.helper
```
Then try pushing again and enter your GitHub Username and **Personal Access Token**.
