# Presence Studio

Presence Studio is a Tauri, React, TypeScript, and Tailwind desktop app for designing and running Discord Rich Presence activities from a safe local workflow.

## What Works

- Local profile, asset, and settings storage in the Tauri app data directory.
- Real Discord IPC through an application Client ID when Discord desktop is running.
- Mock transport for UI testing without connecting to Discord.
- Local asset and avatar previews for the studio UI.
- Frontend and backend validation for Discord RPC constraints.
- Launch at login, native notifications, tray hide/show controls, and live activity updates while a session is running.

## Discord Boundaries

Presence Studio does not use Discord user tokens and should not be extended to collect them. Real Discord identity is owned by the signed-in Discord desktop client. Rich Presence image keys must exist in the Discord Developer Portal for the selected application; local image imports only affect the app preview.

## Development

```bash
npm install
npm run dev
npm run tauri dev
```

## Checks

```bash
npm run build
npm run lint
cd src-tauri
cargo check
cargo test
```
