const readEnv = (key: string, fallback = ''): string => {
  const value = (process.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : fallback;
};

export const config = {
  serverUrl: readEnv('EXPO_PUBLIC_SERVER_URL', 'http://192.168.1.10:4000'),
  defaultAdmin: {
    username: readEnv('EXPO_PUBLIC_ADMIN_USERNAME', 'admin'),
    password: readEnv('EXPO_PUBLIC_ADMIN_PASSWORD', 'admin'),
  },
  firebase: {
    apiKey: readEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: readEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
  },
  imageRetentionMs: 24 * 60 * 60 * 1000,
  maxImagesPerSession: 5,
  instaxAspectRatio: 62 / 46,
};

export const isFirebaseConfigured = (): boolean =>
  Boolean(config.firebase.apiKey && config.firebase.projectId);
