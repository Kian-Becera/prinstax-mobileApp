# PrintStax — Firebase Setup Guide

Complete setup takes about 15–20 minutes.

---

## 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `prinstax` (or anything you like)
3. Disable Google Analytics if you don't need it → **Create project**

---

## 2. Enable Services

### Firestore
1. Left sidebar → **Firestore Database** → **Create database**
2. Choose **Production mode** → pick a region close to you → **Enable**

### Storage
1. Left sidebar → **Storage** → **Get started**
2. Choose **Production mode** → same region → **Done**

### Authentication
1. Left sidebar → **Authentication** → **Get started**
2. **Sign-in method** tab → **GitHub** → Enable
3. Leave the Client ID/Secret fields open — you'll fill them in step 3
4. Copy the **authorization callback URL** shown — you'll need it in step 3

---

## 3. Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: PrintStax Admin
   - **Homepage URL**: `https://your-project.web.app`
   - **Authorization callback URL**: paste the one from Firebase (looks like `https://your-project.firebaseapp.com/__/auth/handler`)
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** → copy it

**Back in Firebase** (Authentication → GitHub):
- Paste the Client ID and Client Secret → **Save**

---

## 4. Deploy Firestore Rules, Storage Rules & Indexes

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Log in
firebase login

# Set your project
# Edit .firebaserc and replace YOUR_FIREBASE_PROJECT_ID
firebase use your-project-id

# Deploy rules and indexes
firebase deploy --only firestore,storage
```

---

## 5. Deploy Firebase Hosting (Client Web App)

```bash
# Deploy the hosting/ directory
firebase deploy --only hosting
```

Your client web app is now live at `https://your-project.web.app`.

---

## 6. Deploy Cloud Functions

```bash
cd functions
npm install
cd ..

# Copy the env example and fill in your GitHub credentials
cp functions/.env.example functions/.env
# Edit functions/.env:
#   GITHUB_CLIENT_ID=Ov23li...
#   GITHUB_CLIENT_SECRET=...

firebase deploy --only functions
```

> **Sharp + Cloud Functions**: Sharp uses native binaries. Firebase Functions builds on Linux, so deployment from Windows/Mac works fine — the CLI cross-compiles automatically.

---

## 7. Configure the Mobile App

```bash
cd mobile

# Install new dependencies
npm install --legacy-peer-deps

# Create your .env file from the example
cp .env.example .env
```

Edit `mobile/.env` and fill in all values:

```env
# From Firebase Console → Project Settings → Your apps → Web app
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Hosting URL (from step 5)
EXPO_PUBLIC_HOSTING_URL=https://your-project.web.app

# GitHub OAuth App Client ID (from step 3)
EXPO_PUBLIC_GITHUB_CLIENT_ID=Ov23li...
```

### Add a Web App to Firebase (for the mobile SDK)

The mobile app uses the Firebase Web SDK. You need a Web App registered:

1. Firebase Console → Project Overview → **</>** (Web)
2. App nickname: `PrintStax Mobile` → **Register app**
3. Copy the `firebaseConfig` values into your `.env`
4. **No** need to set up Firebase Hosting for this app

---

## 8. Configure GitHub OAuth Redirect URI for Expo Go

When developing with **Expo Go**, the OAuth redirect goes through Expo's auth proxy.

1. Go back to your GitHub OAuth App settings
2. Add a second **Authorization callback URL**:
   ```
   https://auth.expo.io/@YOUR_EXPO_USERNAME/prinstax
   ```
   Replace `YOUR_EXPO_USERNAME` with your Expo account username (check `expo whoami`)

For a **production dev build**, the redirect URI is `prinstax://` — add that too when building for production.

---

## 9. Run the Mobile App

```bash
cd mobile
npx expo start
```

Scan the QR with Expo Go. Tap **Continue with GitHub** to sign in.

---

## Flow Summary

```
Admin (mobile app)
  │
  ├── Generates QR → Firestore session created
  │                  QR URL = https://your-project.web.app/?session=ID
  │
Client (web app, phone browser)
  │
  ├── Scans QR → opens web app
  ├── Uploads photos → Firebase Storage (sessions/ID/uuid.jpg)
  └── Updates Firestore session → status: pending
  │
Admin (mobile app) ← Firestore onSnapshot fires instantly
  │
  ├── Review → Edit (processImage Cloud Function applies HSL + crop)
  ├── Approve All
  └── Print (Instax printer via BT/WiFi) → logPrint Cloud Function
                                           → history/{id} written to Firestore
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `githubTokenExchange` returns "GitHub OAuth not configured" | Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `functions/.env` and redeploy |
| Sign-in fails with "redirect_uri_mismatch" | Add the Expo proxy URL to GitHub OAuth App's redirect URIs (step 8) |
| `processImage` function times out | Check that the storage file path in Firestore matches actual Storage path |
| Client web app shows "Session not found" | Deploy Firestore rules (`firebase deploy --only firestore`) |
| Images don't load in mobile app | Check Storage rules allow public reads; redeploy (`firebase deploy --only storage`) |
| `firebase deploy --only functions` fails on Sharp | Run `npm install` inside `functions/` first |
