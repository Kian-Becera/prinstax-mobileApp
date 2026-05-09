# Prinstax — Local Run Guide

Complete instructions for running the app on your local network with a real mobile device via Expo Go.

---

## Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | bundled with Node |
| Expo Go app | latest | App Store / Google Play |

Your phone and development machine **must be on the same Wi-Fi network**.

---

## 1 — Find your machine's local IP

**Windows (PowerShell):**
```powershell
ipconfig
# Look for: IPv4 Address  →  e.g. 192.168.1.42
```

**macOS / Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# e.g. inet 192.168.1.42
```

Write this IP down — you'll use it everywhere below.

---

## 2 — Set up the Server

```powershell
cd server

# Install dependencies
npm install

# Copy env file and set your PIN
cp .env.example .env
# Edit .env:  ADMIN_PIN=your4digitpin

# Start the server
npm run dev
```

You should see:
```
✦ Prinstax server  →  http://localhost:3000
  Clients scan QR   →  http://<your-ip>:3000/?session=<id>
```

**Keep this terminal open** — the server must stay running.

---

## 3 — Set up the Mobile App

Open a **new** terminal:

```powershell
cd mobile

# Install dependencies
npm install

# Copy env and set your server IP
cp .env.example .env
# Edit .env:
#   EXPO_PUBLIC_SERVER_URL=http://192.168.1.42:3000
#   EXPO_PUBLIC_ADMIN_PIN=your4digitpin   ← same PIN as server/.env

# Start Expo
npx expo start
```

Expo will display a **QR code** in the terminal and a Metro bundler URL.

---

## 4 — Open in Expo Go

1. Open the **Expo Go** app on your phone.
2. Scan the QR code shown in the terminal.
3. The app will load — enter your PIN (`1234` by default).

> **iOS:** Use the built-in Camera app to scan, or the Expo Go scanner.  
> **Android:** Use the Expo Go in-app scanner.

---

## 5 — Test the Full Flow

### Step A — Generate a QR code (Admin)
1. Log in with PIN `1234` (or your custom PIN).
2. Tap the **QR Code** tab.
3. Tap **Generate QR Code**.
4. A QR code appears — this links clients to your upload page.

### Step B — Client uploads photos
1. On a **second device** (or the same phone in a browser), scan the QR code.
2. The client web app opens at `http://192.168.1.42:3000/?session=<id>`.
3. Enter a name, date (optional), select up to 5 photos.
4. Check the consent box and tap **Send to Print Station**.

### Step C — Admin receives notification
1. Back in the Expo Go app, a push alert appears: **"New Upload 📷"**.
2. Tap **Review** or go to the **Review** tab.

### Step D — Edit (optional)
- Tap the ✏️ button on any image to open the **Editor**.
- Adjust Hue / Saturation / Brightness with sliders.
- Tap **Apply Edits** — the server processes the image using Sharp and returns the result.
- The preview updates with the cropped & adjusted version (62×46mm Instax ratio).

### Step E — Approve & Print
- On the Review screen, tap **Approve All** (batch) or approve individually.
- Each approved image shows a **Print** button.
- In Expo Go, tapping Print simulates the 8-second print process.
- After print, the image is logged to History.

### Step F — Check History
- Go to the **History** tab to see all prints with thumbnails, client names, and timestamps.
- Today's count is shown in the stats row.

### Step G — 24-Hour Cleanup
- The server runs a cleanup job every 5 minutes.
- Sessions older than 24 hours are deleted automatically (files + metadata).
- Print history log is preserved (metadata only — no image files).

---

## 6 — Settings

In the **Settings** tab:

| Setting | Notes |
|---------|-------|
| Server URL | Update if your machine's IP changes |
| Instax Printer | Scan for BLE devices (simulated in Expo Go) |
| Change PIN | Enter current PIN + new PIN to update |

---

## 7 — Troubleshooting

### "Session not found or expired" on the client web page
- The server isn't running, or the QR was generated with a different server IP.
- Make sure `npm run dev` is running in `server/`.

### Expo Go can't connect / Metro bundler unreachable
- Confirm your phone and PC are on the **same Wi-Fi** (not a guest network).
- Some corporate/hotel networks block device-to-device traffic — use a personal hotspot instead.
- Run `npx expo start --tunnel` to use Expo's ngrok tunnel as a fallback.

### Images don't load in the Review / Editor screens
- The `EXPO_PUBLIC_SERVER_URL` in `mobile/.env` must match your machine's actual LAN IP.
- Confirm the server is reachable: open `http://192.168.1.42:3000` in your phone's browser.

### `sharp` fails to install on Windows
```powershell
npm install --ignore-scripts
npm rebuild sharp
```

### NativeWind / Tailwind classes not applying
- Confirm `global.css` is imported in `app/_layout.tsx` (first line).
- Delete `.expo/` and restart: `npx expo start --clear`.

---

## 8 — Project Structure

```
prinstax-mobileApp/
├── server/                  Node.js backend
│   ├── index.js             Express + Socket.io + cron cleanup
│   ├── public/              Client web app (served statically)
│   │   ├── index.html
│   │   ├── app.js
│   │   └── style.css
│   ├── uploads/             Uploaded images (auto-cleaned after 24hr)
│   └── data/                sessions.json + history.json
│
└── mobile/                  Expo React Native admin app
    ├── app/
    │   ├── (auth)/login.tsx     PIN login screen
    │   └── (app)/
    │       ├── dashboard.tsx    Live stats + session feed
    │       ├── qr.tsx           QR code generator
    │       ├── review.tsx       Approve / print images
    │       ├── editor.tsx       HSL + crop editor
    │       ├── history.tsx      Print log with thumbnails
    │       └── settings.tsx     Server URL, PIN, printer
    └── src/
        ├── lib/
        │   ├── api.ts           Typed API client
        │   ├── auth.ts          PIN auth + session
        │   ├── config.ts        AsyncStorage config
        │   ├── instaxPrinter.ts Printer interface (simulated)
        │   └── cleanup.ts       TTL formatting
        ├── state/AuthContext.tsx
        └── components/StatusPill.tsx
```

---

## 9 — Production Notes (Beyond Expo Go)

| Feature | Expo Go | Dev Build Required |
|---------|---------|-------------------|
| QR generation | ✅ | — |
| Image upload & review | ✅ | — |
| HSL editing via server | ✅ | — |
| Push notifications | ✅ (in-app alerts) | FCM for background |
| Real Bluetooth printing | ❌ simulated | ✅ react-native-ble-plx |
| Actual Instax SDK | ❌ | ✅ native module |

To build a custom development build:
```powershell
cd mobile
npm install -g eas-cli
eas build --profile development --platform android
# or: eas build --profile development --platform ios
```

Then open the build on your device and run `npx expo start` as normal.
