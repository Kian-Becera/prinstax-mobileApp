import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { config } from './config';

const KEY_USERNAME = 'prinstax.admin.username';
const KEY_PASSWORD = 'prinstax.admin.password';
const KEY_BIO_ENABLED = 'prinstax.bio.enabled';

const seed = async (): Promise<void> => {
  const u = await SecureStore.getItemAsync(KEY_USERNAME);
  if (!u) {
    await SecureStore.setItemAsync(KEY_USERNAME, config.defaultAdmin.username);
    await SecureStore.setItemAsync(KEY_PASSWORD, config.defaultAdmin.password);
  }
};

export async function loginWithPassword(username: string, password: string): Promise<boolean> {
  await seed();
  const u = await SecureStore.getItemAsync(KEY_USERNAME);
  const p = await SecureStore.getItemAsync(KEY_PASSWORD);
  return u === username && p === password;
}

export async function changeCredentials(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_USERNAME, username);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
}

export interface BiometricCapabilities {
  hardwareAvailable: boolean;
  enrolled: boolean;
  faceId: boolean;
  fingerprint: boolean;
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return {
    hardwareAvailable: hardware,
    enrolled,
    faceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
    fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
  };
}

export async function isBiometricEnabled(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(KEY_BIO_ENABLED);
  return flag === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_BIO_ENABLED, enabled ? '1' : '0');
}

export async function authenticateWithBiometrics(reason = 'Unlock Prinstax'): Promise<boolean> {
  const caps = await getBiometricCapabilities();
  if (!caps.hardwareAvailable || !caps.enrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Use password',
    fallbackLabel: 'Use password',
    disableDeviceFallback: false,
  });
  return result.success;
}
