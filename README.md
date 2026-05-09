# Prinstax — admin printing app

Prinstax is a private, invite-only photo printing app built for Instax device owners who want to offer a seamless, event-ready photo experience. The admin generates a QR code, clients scan and upload their photos, and prints are delivered with zero friction — all from one secure, minimal interface.

This repo is a monorepo with two parts:

- **`mobile/`** — the admin app. Expo (React Native) project with a custom dev client and a local native module stub for the Instax printer.
- **`server/`** — a tiny local Express server that hosts the QR-upload web page and accepts client uploads onto your dev machine's disk.

The admin app uses **Firestore** for print history, daily counters, and session metadata. Client images live on the local Express server and are served back to the mobile app over your LAN.

---

## Architecture at a glance

```
   Client phone                 Dev machine                     Admin phone
   (any browser)                                                (Prinstax dev client)
        │                              │                                │
        │  (1) scans QR                │                                │
        │ ─────────────────────────►  Express :4000                     │
        │  (2) uploads photos          │   /api/sessions/:id/upload     │
        │                              │   /files/:id/<name>.jpg        │
        │                              │                                │
        │                              │ ◄────────────────────────────  │
        │                              │   list sessions, fetch images  │
        │                              │                                │
        │                              │   ┌────────────┐               │
        │                              │   │  Firestore │ ◄───── print  │
        │                              │   │  (logs,    │       logs,   │
        │                              │   │   counters)│       sessions│
        │                              │   └────────────┘               │
        │                              │                                │
        │                              │              Bluetooth ──►  Instax
```

---

## Prerequisites

| Tool | Why |
| --- | --- |
| Node.js 20.x LTS | Both projects |
| Git | clone / commit |
| **Android Studio** *or* **Xcode 15+** | One real device build is required because Expo Go cannot load local native modules |
| Android device with USB debugging *or* an iPhone with the Apple developer setup | Run target |
| A Wi-Fi network the dev machine and phones share | Web upload + Metro |
| (optional) Firebase project | Persistent print history |

> **Why no Expo Go?** The app declares a local Expo native module (`mobile/modules/instax-printer`). Expo Go only loads JS — to use the module you build a custom dev client. The JS code falls back to a mock printer when the native module isn't available, so you can still launch the app via Expo Go for screen-by-screen testing, just with no real (or stub) Instax connection.

---

## 1. First-time setup

### 1a. Clone and install

```bash
git clone <this-repo>
cd prinstax-mobileApp

# Server
cd server
npm install
cp .env.example .env       # PowerShell: Copy-Item .env.example .env

# Mobile
cd ../mobile
npm install
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
```

### 1b. Find your dev machine's LAN IP

```powershell
# PowerShell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' }).IPAddress
```

```bash
# macOS / Linux
ipconfig getifaddr en0   # macOS Wi-Fi
hostname -I              # Linux
```

Pick the address your phones can reach (typically `192.168.x.x` or `10.0.x.x`). Edit `mobile/.env`:

```env
EXPO_PUBLIC_SERVER_URL=http://192.168.1.10:4000
```

> Don't use `localhost` — that resolves to the phone, not your dev machine.

### 1c. (Optional) wire up Firestore

Without Firestore, print history and the daily counter are no-ops; everything else works. To enable:

1. Create a Firebase project → Project settings → "Your apps" → Add web app.
2. Copy the config values into `mobile/.env`:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```
3. In the Firebase console, enable **Firestore** (start in test mode for local dev). Collections used: `sessions`, `printLogs`, `counters` — they're created on first write.

### 1d. Allow the server through Windows Firewall (Windows hosts)

When you start the Express server the first time, Windows will prompt — allow on **Private** networks. Without this, the client phones cannot reach the upload page.

---

## 2. Build the mobile dev client

Pick whichever side you can build for.

### Android (Windows / macOS / Linux)

```bash
cd mobile
npm run prebuild         # generates the android/ folder with the local native module wired in
npm run android          # builds & installs the dev client on a connected device
```

After the first build, **subsequent runs only need `npm start`** — the dev client app on your device just connects to Metro.

### iOS (macOS only)

```bash
cd mobile
npm run prebuild
npm run ios              # builds & installs onto an attached iPhone or Simulator
```

> The native module ships as a stub (mock data only). Drop the Fujifilm Instax SDK in and replace the bodies in `modules/instax-printer/ios/InstaxPrinterModule.swift` and `…/android/.../InstaxPrinterModule.kt` to print for real.

---

## 3. Daily run

Open **two terminals**.

### Terminal A — server

```bash
cd server
npm start
# Prinstax server listening on http://0.0.0.0:4000
```

### Terminal B — mobile

```bash
cd mobile
npm start
```

Then on the **admin device**, open the Prinstax dev client app (already installed). It auto-connects to Metro on your LAN. If it doesn't, scan the QR Metro printed in the terminal.

> If you didn't build a dev client (e.g. you want a quick screen-by-screen smoke test in Expo Go), you can run `npm run start:tunnel` and open the project in Expo Go — but the Instax module will fall back to mock mode.

---

## 4. End-to-end test (the happy path)

1. **Sign in.** Default `admin` / `admin`. Tap **Use Face ID / Fingerprint** if your device has biometrics enrolled — first attempt enrolls it for next time.
2. **Generate a QR.** Dashboard → "Generate QR for client". The QR encodes `http://<your-LAN-IP>:4000/upload/<sessionId>`.
3. **On a second phone**, point the camera at the QR. Tap the link.
4. On the upload page:
   - Tap **Choose photos** or **Take a photo** (camera capture works on iOS/Android).
   - Watch the per-tile quality badges (`MP · low|ok|good`) — this is the live compression preview.
   - Type a name + date, tick the **consent** checkbox, hit **Send to print**.
5. **Back on the admin app.** Pull-to-refresh the dashboard. The session shows under "Awaiting review".
6. Tap the session → tap **Edit** on a photo to open the editor (Hue / Saturation / Lightness sliders, auto-crop to 62×46). Tap **Apply & print**.
7. Or use **Approve & print all (5)** to batch-print without per-image edits.
8. Open **Settings** → "Scan for printers" → tap a discovered device to "Connect" (mock until you wire up the SDK).
9. Open **Print history** to see prints with thumbnails. Tap **Run cleanup now** to manually evict expired sessions.

---

## 5. What the app gives you, by spec line

| Requirement | Where it lives |
| --- | --- |
| Single admin user, basic auth | `mobile/src/lib/auth.ts` (creds in SecureStore, default `admin`/`admin`) |
| Biometric login (Face / Fingerprint) | `mobile/src/lib/auth.ts` + `app/(auth)/login.tsx` |
| Bluetooth + Wi-Fi + Instax connectivity in Settings | `app/(app)/settings.tsx` |
| Admin generates QR | `app/(app)/qr.tsx` |
| Client scans QR → uploads (5 max), name + date, send | `server/public/{index.html, app.js}` |
| Admin notified, previews, edits | `app/(app)/dashboard.tsx`, `review.tsx`, `editor.tsx` |
| HSL adjust + auto-crop to Instax 62×46 | `app/(app)/editor.tsx` (Skia ColorMatrix + expo-image-manipulator) |
| Print to Instax | `mobile/src/lib/instaxPrinter.ts` ↔ `mobile/modules/instax-printer/*` |
| 24h auto-delete | `mobile/src/lib/cleanup.ts` (background fetch) + `server/index.js` (interval + `/api/cleanup`) |
| Print history log w/ thumbnails | `app/(app)/history.tsx` ← Firestore `printLogs` |
| Batch approve | `app/(app)/review.tsx` (Approve & print all) |
| Daily print counter | Firestore `counters/<YYYY-MM-DD>`, shown on dashboard + history |
| Live compression preview | `server/public/app.js` (megapixel quality badges) |
| Camera capture from client phone | `<input capture="environment">` in `index.html` |
| Consent checkbox | upload page; enforced server-side in `/api/sessions/:id/upload` |

---

## 6. Wiring the real Fujifilm Instax SDK

Both native module files are stubs with `TODO` comments where the SDK calls go:

- `mobile/modules/instax-printer/ios/InstaxPrinterModule.swift` — replace `connect`, `disconnect`, `print`, `scanForDevices`, `getStatus` bodies with the SDK's CoreBluetooth flow. The mini format is **600×800 px @ 318 dpi**; the wrapper already crops/sizes via `expo-image-manipulator` before the URI hits this method.
- `mobile/modules/instax-printer/android/.../InstaxPrinterModule.kt` — drop the SDK `.aar` into `mobile/modules/instax-printer/android/libs/` and update `build.gradle`, then replace the same set of methods.

The JS layer (`mobile/src/lib/instaxPrinter.ts`) detects whether the native module is present and falls back to a mock if not — so you can develop the rest of the app against fake data, then plug the SDK in last.

---

## 7. Common problems

| Symptom | Cause / fix |
| --- | --- |
| `Server unreachable` banner on the dashboard | `EXPO_PUBLIC_SERVER_URL` is wrong, server isn't running, or Windows Firewall is blocking Express. Hit `http://<LAN-IP>:4000/upload/test` from the admin phone's browser to confirm reachability. |
| QR page on client phone says "Cannot GET /upload/…" | Server is running but no session was created for that id. Re-tap "New QR" in the admin app. |
| `requireNativeModule('InstaxPrinter') failed` after a `npm start` | You didn't run `npm run prebuild && npm run android/ios`. Build the dev client once. |
| Biometric button hidden on the login screen | Device has no enrolled biometrics. Add Face/Fingerprint in OS settings, then relaunch. |
| Print history is always empty | Firestore not configured (see **1c**) — print attempts succeed, but the log writes are no-ops. |
| Reanimated babel-plugin error | Make sure `babel.config.js` lists `react-native-reanimated/plugin` last, and run `npm start -- --clear` once. |

---

## 8. Project layout

```
prinstax-mobileApp/
├── README.md
├── server/
│   ├── index.js                  Express app, sessions store, /api routes, cleanup
│   ├── package.json
│   ├── .env.example
│   ├── public/                   client web upload page
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   └── uploads/                  (gitignored, runtime)
└── mobile/
    ├── app.json
    ├── package.json
    ├── babel.config.js
    ├── tsconfig.json
    ├── .env.example
    ├── app/                      Expo Router screens
    │   ├── _layout.tsx
    │   ├── index.tsx             redirect to /(auth)/login
    │   ├── (auth)/login.tsx
    │   └── (app)/
    │       ├── dashboard.tsx
    │       ├── qr.tsx
    │       ├── review.tsx
    │       ├── editor.tsx
    │       ├── history.tsx
    │       └── settings.tsx
    ├── src/
    │   ├── components/StatusPill.tsx
    │   ├── lib/
    │   │   ├── api.ts            Express server client
    │   │   ├── auth.ts           Credentials + biometrics
    │   │   ├── cleanup.ts        Background-fetch task
    │   │   ├── config.ts         env-driven config
    │   │   ├── firebase.ts       Firestore queries
    │   │   └── instaxPrinter.ts  TS wrapper around the native module (with mock)
    │   └── state/AuthContext.tsx
    └── modules/instax-printer/   Local Expo native module
        ├── expo-module.config.json
        ├── package.json
        ├── index.ts
        ├── ios/InstaxPrinter.podspec
        ├── ios/InstaxPrinterModule.swift
        └── android/
            ├── build.gradle
            └── src/main/java/expo/modules/instaxprinter/InstaxPrinterModule.kt
```

---

## 9. Status

This is a working scaffold. Not yet implemented (intentionally out of scope for the first cut):

- Real Fujifilm SDK calls (stubs in place, see §6).
- Image storage in Firebase Storage (uploads stay on the local Express server's disk for now).
- Push notifications (the dashboard uses pull-to-refresh).
- Fine-grained Firestore rules (start in test mode locally; lock down before deploying).
