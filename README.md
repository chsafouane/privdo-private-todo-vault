# Local Todo Manager

A simple, private, and secure todo list application that encrypts your tasks locally on your device. Designed with privacy in mind—no cloud storage, no account required, and fully offline capable.

## Features

- **🔒 Local Encryption:** All tasks are encrypted using AES-256 (`crypto-js`) before being stored locally on your device.
- **📱 Installable App (PWA):** Works seamlessly as a standalone application on macOS, iOS, Android, and Windows.
- **⚡ Offline First:** Everything is stored locally via `localforage`. No internet connection needed.
- **🎨 Beautiful UI:** Built with React, TailwindCSS, and Framer Motion for a smooth user experience.

## How to Use

1. **Add a Task:** Simply type your task in the input field and hit "Add" or press Enter.
2. **Complete a Task:** Click the checkbox next to any active task to mark it as complete.
3. **Delete a Task:** Click the trash icon next to a task to permanently remove it.
4. *(All data is automatically encrypted and saved seamlessly as you interact with the app).*

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production (web)
npm run build
```

---

## Building for All Platforms

This app can be distributed as a **PWA** (web), a **macOS desktop app** (Electron), and a **native iOS / Android app** (Capacitor).

### 1. PWA — Web, iPhone & Android (Add to Home Screen)

The simplest way to use the app on any device. Build the web app and host it on any static server (Vercel, Netlify, GitHub Pages, or even `npx serve dist`).

```bash
npm run build
```

The production files are output to `dist/`. Deploy this folder to your hosting provider.

**Install on your device:**

| Platform | Steps |
|---|---|
| **iPhone / iPad** | Open the URL in **Safari** → tap **Share** → **Add to Home Screen** → **Add** |
| **Android** | Open the URL in **Chrome** → tap **⋮ Menu** → **Install app** |
| **macOS / Windows / Linux** | Open in Chrome/Edge → click the **Install** icon in the address bar |

### 2. macOS Desktop App (.dmg) — Electron

Build a native macOS `.dmg` installer that can be dragged into your Applications folder.

**Prerequisites:**
- macOS (Electron builds are platform-specific)
- Node.js 18+

```bash
# Development mode (live reload)
npm run electron:dev

# Build the .dmg installer
npm run electron:build
```

The `.dmg` file will be in the `release/` folder. Double-click to mount and drag the app into Applications.

### 3. iOS App (.ipa) — Capacitor + Xcode

Build a native iOS app that can be installed on your iPhone/iPad or submitted to the App Store.

**Prerequisites:**
- macOS with **Xcode** installed (free from the Mac App Store)
- An Apple Developer account (free for personal device testing, paid for App Store)
- CocoaPods: `sudo gem install cocoapods`

**Steps:**

```bash
# 1. Build the web app and sync to the iOS project
npm run ios:open
```

This builds the web app, syncs it into the `ios/` Xcode project, and opens Xcode.

```bash
# Or do it step by step:
npm run build          # Build the web app
npx cap sync ios       # Copy web assets + update native plugins
npx cap open ios       # Open the Xcode project
```

**In Xcode:**
1. Select your **Team** under *Signing & Capabilities* (your Apple Developer account).
2. Connect your iPhone via USB or select a simulator.
3. Click the **Run** (▶) button to build and install.
4. To create an `.ipa` for distribution: *Product → Archive → Distribute App*.

### 4. Android App (.apk / .aab) — Capacitor + Android Studio

Build a native Android app that can be installed directly or submitted to the Google Play Store.

**Prerequisites:**
- **Android Studio** installed ([download](https://developer.android.com/studio))
- Android SDK (installed automatically with Android Studio)
- Java 17+ (bundled with Android Studio)

**Steps:**

```bash
# 1. Build the web app and sync to the Android project
npm run android:open
```

This builds the web app, syncs it into the `android/` Gradle project, and opens Android Studio.

```bash
# Or do it step by step:
npm run build            # Build the web app
npx cap sync android     # Copy web assets + update native plugins
npx cap open android     # Open in Android Studio
```

**In Android Studio:**
1. Wait for Gradle sync to finish.
2. Connect your Android phone via USB (enable *USB Debugging*) or select an emulator.
3. Click the **Run** (▶) button to build and install.
4. To create a signed APK/AAB: *Build → Generate Signed Bundle / APK…*

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build web app to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run electron:dev` | Run Electron in development mode |
| `npm run electron:build` | Build macOS `.dmg` installer |
| `npm run cap:sync` | Build web + sync to iOS & Android |
| `npm run ios:open` | Build, sync, and open Xcode |
| `npm run android:open` | Build, sync, and open Android Studio |

---

## Project Structure

```
src/              → React app source code
electron/         → Electron main process + preload
ios/              → Xcode project (Capacitor)
android/          → Android Studio project (Capacitor)
public/           → Static assets & PWA icons
dist/             → Production build output (git-ignored)
release/          → Electron build output (git-ignored)
```

## License

MIT
