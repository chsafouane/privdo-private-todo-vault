# Privdo

A private, encrypted todo list that lives on your device. Tasks are encrypted with AES-256 and protected by a PIN. Optional end-to-end encrypted sync keeps devices in sync without the server ever seeing your data.

Available as a **web app**, **PWA**, **macOS desktop app**, **Chrome/Brave extension**, and **iOS/Android app**.

## Features

- **Local Encryption** — All tasks encrypted with AES-256 (PBKDF2 key derivation, 600k iterations) before storage. Your PIN never leaves your device.
- **End-to-End Encrypted Sync** — Optional cross-device sync via Supabase. The server only stores opaque encrypted blobs — it can never read your tasks.
- **Two Sync Modes** — Passphrase-only (no account, maximum privacy) or Email account with a separate sync passphrase.
- **Multiple Lists** — Organize tasks into named lists with easy switching.
- **Deadlines & Notifications** — Set due dates and get desktop notifications when tasks are overdue.
- **Search & Sort** — Filter tasks by text, sort by date, deadline, or alphabetically.
- **Undo Delete** — 5-second undo window after deleting a task.
- **Dark / Light Mode** — Follows your system preference or set manually.
- **Export / Import** — PIN-encrypted backups you can move between devices.
- **Offline First** — Works without internet. Sync is optional and resilient to connectivity loss.
- **Cross-Platform** — Runs on macOS, Windows, Linux, iOS, Android, and any modern browser.

## Security

| Property | Detail |
|---|---|
| **Local Cipher** | AES-256 via CryptoJS |
| **Key Derivation** | PBKDF2, 600,000 iterations, 16-byte random salt |
| **PIN Storage** | Only a PBKDF2-derived hash is stored — never the PIN itself |
| **Data Location** | Browser IndexedDB (web/PWA), local filesystem (Electron), or localStorage (extension) |
| **Sync Encryption** | AES-256 with PBKDF2-derived key (600k iterations, separate from local encryption) |
| **Sync Server** | Zero-knowledge — stores only encrypted blobs and random channel IDs |
| **Network** | Zero network calls unless sync is enabled. Local data is always the source of truth. |

See [SECURITY.md](SECURITY.md) for more details.

---

## Cross-Device Sync

Privdo supports optional end-to-end encrypted sync. All encryption happens on your device — the server never sees plaintext data.

### How It Works

1. **Passphrase Mode** — Generate or enter a 12-word passphrase (BIP39, 128-bit entropy). The passphrase derives both a channel ID (SHA-256) and an encryption key (PBKDF2). No account or email needed.
2. **Email Mode** — Sign up with email/password via Supabase Auth for identity, plus a separate sync passphrase for encryption. The auth password and encryption key are independent.

### Setting Up Sync

1. Click the cloud icon in the header toolbar
2. Choose **Passphrase Only** (maximum privacy) or **Email Account**
3. For passphrase mode: save the generated 12-word passphrase, then enter it on other devices
4. For email mode: create an account and set a sync passphrase

### Sync Behavior

- **On app open**: pulls from cloud, merges, pushes if needed
- **On task change**: debounced push (2-second delay)
- **Periodic**: every 5 minutes while the app is open
- **Manual**: "Sync Now" button in sync settings
- **Offline**: changes are queued and synced when back online

### Self-Hosting

Privdo uses Supabase as the sync backend. To self-host:

1. Create a [Supabase](https://supabase.com) project (free tier works)
2. Run the migration in `supabase/migrations/001_sync_blobs.sql`
3. Deploy the Edge Function in `supabase/functions/sync/`
4. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

Without these variables, sync is simply unavailable — the app works fully offline.

---

## Quick Start

```bash
npm install
npm run dev
```

---

## Platforms & Build Instructions

### 1. Web App (PWA)

Build and host on any static server. Installable on any device via the browser.

```bash
npm run build
```

Output: `dist/` — deploy to Vercel, Netlify, GitHub Pages, or serve locally with `npx serve dist`.

| Platform | Install Steps |
|---|---|
| **iPhone / iPad** | Safari → Share → Add to Home Screen |
| **Android** | Chrome → ⋮ Menu → Install app |
| **Desktop** | Chrome/Edge → Install icon in address bar |

### 2. macOS Desktop (.dmg) — Electron

```bash
# Development (live reload)
npm run electron:dev

# Build .dmg installer
npm run electron:build
```

The `.dmg` is output to `release/`. Drag to Applications to install.

**Requires:** macOS, Node.js 18+

### 3. Chrome / Brave Extension

The app can run as a browser extension popup (400×600).

**Build the extension:**

The Flutter version of Privdo ([`chsafouane/privdo-flutter`](https://github.com/chsafouane/privdo-flutter)) includes a build script that packages the web app as a Manifest V3 Chrome extension:

```bash
# In the privdo-flutter repo:
./build_chrome_extension.sh
```

This runs `flutter build web`, then assembles `chrome_extension/` with the correct manifest, CSP, and popup sizing.

**Install:**

1. Open `chrome://extensions` in Chrome or Brave
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome_extension/` directory

The extension icon appears in your toolbar — click it to open Privdo.

### 4. iOS App — Capacitor + Xcode

```bash
npm run ios:open
```

This builds the web app, syncs to the `ios/` project, and opens Xcode.

**In Xcode:**
1. Select your Team under *Signing & Capabilities*
2. Connect your iPhone or pick a simulator
3. Click Run (▶)

**Requires:** macOS, Xcode, Apple Developer account, CocoaPods (`sudo gem install cocoapods`)

### 5. Android App — Capacitor + Android Studio

```bash
npm run android:open
```

This builds the web app, syncs to the `android/` project, and opens Android Studio.

**In Android Studio:**
1. Wait for Gradle sync
2. Connect your device (USB Debugging enabled) or pick an emulator
3. Click Run (▶)

**Requires:** Android Studio, Java 17+

### 6. Flutter Version (macOS native + Web + Extension)

A native Flutter port is available at [`chsafouane/privdo-flutter`](https://github.com/chsafouane/privdo-flutter). It shares the same encryption format and supports:

- **macOS** — native desktop app via `flutter build macos`
- **Web** — `flutter build web --release`, serve the `build/web/` output
- **Chrome Extension** — `./build_chrome_extension.sh` (see section 3 above)

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build web app to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run electron:dev` | Run Electron in dev mode with hot reload |
| `npm run electron:build` | Build macOS `.dmg` installer |
| `npm run cap:sync` | Build web + sync to iOS & Android |
| `npm run ios:open` | Build, sync, and open Xcode |
| `npm run android:open` | Build, sync, and open Android Studio |

---

## Tech Stack

| | |
|---|---|
| **Frontend** | React 19, TypeScript, TailwindCSS, Framer Motion |
| **UI** | Radix UI primitives, Phosphor Icons |
| **Build** | Vite + PWA plugin |
| **Storage** | Localforage (IndexedDB) for web, filesystem for Electron |
| **Crypto** | CryptoJS (AES-256, PBKDF2) + Web Crypto API (sync encryption) |
| **Sync** | Supabase (optional — E2E encrypted, zero-knowledge server) |
| **Desktop** | Electron (macOS .dmg) |
| **Mobile** | Capacitor (iOS + Android) |
| **Flutter** | Dart, Riverpod, PointyCastle — same encryption, native performance |

## Project Structure

```
src/              → React app source code
  lib/            → Encryption, sync, and utility modules
  hooks/          → React hooks (sync engine, encrypted storage)
  components/     → UI components (sync setup, settings, status)
electron/         → Electron main process + preload
ios/              → Xcode project (Capacitor)
android/          → Android Studio project (Capacitor)
chrome_extension/ → Prebuilt Chrome/Brave extension
supabase/         → Sync backend (migrations, Edge Functions)
public/           → Static assets & PWA icons
dist/             → Production build output (git-ignored)
release/          → Electron build output (git-ignored)
```

## License

MIT
