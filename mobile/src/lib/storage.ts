import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadResult {
  storagePath: string;
  downloadUrl: string;
}

/**
 * Uploads a local file (by URI) to Firebase Storage under the given path.
 * Used when the admin needs to upload images directly (not via the web app).
 */
export async function uploadImage(
  uri: string,
  storagePath: string,
): Promise<UploadResult> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(storage, storagePath);
  const snap = await uploadBytes(fileRef, blob);
  const downloadUrl = await getDownloadURL(snap.ref);
  return { storagePath, downloadUrl };
}
