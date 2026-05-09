import {
  signInWithCredential, signOut as firebaseSignOut,
  GithubAuthProvider, onAuthStateChanged, User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

export type { User };
export { onAuthStateChanged, auth };

/**
 * Exchanges a GitHub OAuth authorization code for a Firebase credential
 * and signs in. The GitHub client_secret lives in the Cloud Function.
 */
export async function signInWithGitHubCode(code: string, redirectUri: string): Promise<void> {
  const exchange = httpsCallable<
    { code: string; redirectUri: string },
    { access_token: string }
  >(functions, 'githubTokenExchange');

  const { data } = await exchange({ code, redirectUri });
  const credential = GithubAuthProvider.credential(data.access_token);
  await signInWithCredential(auth, credential);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
