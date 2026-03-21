# Running Rhodes Dashboard with systemd

User-level systemd services let the dashboard start on boot without root.

## Setup

Replace `/home/ollie/Development/Projects/rhodes-dashboard` with your actual project path.

### Backend service

```ini
# ~/.config/systemd/user/rhodes-backend.service
[Unit]
Description=Rhodes Dashboard Backend (FastAPI)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ollie/Development/Projects/rhodes-dashboard/backend
Environment=PATH=/home/ollie/Development/Projects/rhodes-dashboard/backend/venv/bin:/usr/bin
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-/home/ollie/Development/Projects/rhodes-dashboard/.env
ExecStart=/home/ollie/Development/Projects/rhodes-dashboard/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8521
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

### Frontend service

```ini
# ~/.config/systemd/user/rhodes-frontend.service
[Unit]
Description=Rhodes Dashboard Frontend (Next.js)
After=rhodes-backend.service

[Service]
Type=simple
WorkingDirectory=/home/ollie/Development/Projects/rhodes-dashboard/frontend
Environment=PATH=/home/ollie/.nvm/versions/node/v22.21.1/bin:/usr/bin
Environment=NODE_ENV=production
Environment=PORT=3489
ExecStart=/home/ollie/.nvm/versions/node/v22.21.1/bin/npx next start --port 3489
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

## Commands

```bash
# Copy service files
mkdir -p ~/.config/systemd/user
cp docs/rhodes-backend.service ~/.config/systemd/user/
cp docs/rhodes-frontend.service ~/.config/systemd/user/

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now rhodes-backend
systemctl --user enable --now rhodes-frontend

# Check status
systemctl --user status rhodes-backend
systemctl --user status rhodes-frontend

# View logs
journalctl --user -u rhodes-backend -f
journalctl --user -u rhodes-frontend -f

# Stop
systemctl --user stop rhodes-frontend rhodes-backend

# Disable (won't start on boot)
systemctl --user disable rhodes-frontend rhodes-backend
```

## Notes

- Run `npm run build` in `frontend/` before enabling the frontend service (it runs `next start`, not `next dev`)
- Ensure `loginctl enable-linger ollie` is set so user services run without an active login session
- The backend service loads `.env` from the project root for `DEVTO_API_KEY` and `DASHBOARD_API_KEY`
