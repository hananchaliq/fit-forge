import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface GoogleSignInResult {
  ok: boolean;
  user?: User;
  code?: string;
  message?: string;
  isUnauthorizedDomain?: boolean;
  isPopupBlocked?: boolean;
  isClosedByUser?: boolean;
  isEmbeddedIframe?: boolean;
}

let googlePopupPromise: Promise<GoogleSignInResult> | null = null;
let persistenceInitStarted = false;

function initBestAuthPersistence(): void {
  if (typeof window === 'undefined' || persistenceInitStarted) return;
  persistenceInitStarted = true;
  void setPersistence(auth, browserLocalPersistence)
    .catch(() => setPersistence(auth, browserSessionPersistence))
    .catch(() => setPersistence(auth, inMemoryPersistence))
    .catch(() => {
      // Ignore persistence fallback errors
    });
}

// Initialize persistence eagerly on the client so signInWithPopup runs synchronously inside click events
initBestAuthPersistence();

function extractFirebaseErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/auth\/[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : 'auth/unknown';
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Resilient Google Auth Popup launcher:
 * - Calls signInWithPopup synchronously inside the user click tick (no prior await) so browsers never kill the popup window
 * - Prevents concurrent double-clicks (`auth/cancelled-popup-request`)
 * - Uses explicit `browserPopupRedirectResolver`
 * - Never swallows errors silently: returns exact Firebase code and clear Indonesian guidance
 */
export function signInWithGoogleSafe(): Promise<GoogleSignInResult> {
  if (googlePopupPromise) return googlePopupPromise;

  const isEmbeddedIframe = isRunningInIframe();
  // Fire signInWithPopup immediately inside the click gesture before any async boundary
  const popupAttempt = signInWithPopup(
    auth,
    googleProvider,
    browserPopupRedirectResolver
  );

  googlePopupPromise = popupAttempt
    .then((credential): GoogleSignInResult => ({
      ok: true,
      user: credential.user,
      isEmbeddedIframe,
    }))
    .catch((err): GoogleSignInResult => {
      const code = extractFirebaseErrorCode(err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'domain ini';

      const isUnauthorizedDomain = code === 'auth/unauthorized-domain';
      const isPopupBlocked =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment';
      const isClosedByUser =
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request';

      let message = `Gagal masuk dengan Google (${code}): ${rawMsg}`;
      if (isUnauthorizedDomain) {
        message = `Domain "${host}" belum terdaftar di Authorized Domains Firebase (${firebaseConfig.projectId}). Tambahkan domain di Firebase Console atau gunakan Masuk Instan di bawah.`;
      } else if (isPopupBlocked) {
        message = isEmbeddedIframe
          ? `Popup Google diblokir di dalam pratinjau iframe (${code}). Klik "Buka di Tab Baru" agar popup Google berjalan penuh, atau gunakan Masuk Instan.`
          : `Popup login Google diblokir oleh browser (${code}). Izinkan pop-up untuk situs ini lalu klik coba lagi.`;
      } else if (isClosedByUser) {
        message = isEmbeddedIframe
          ? `Popup Google otomatis tertutup di dalam pratinjau iframe (${code}). Klik "Buka di Tab Baru" untuk login Google penuh, atau gunakan Masuk Instan.`
          : `Jendela login Google ditutup sebelum selesai (${code}). Klik tombol Masuk Google lagi untuk melanjutkan.`;
      } else if (code === 'auth/network-request-failed') {
        message = 'Koneksi jaringan ke server Google Auth gagal. Periksa koneksi internet Anda lalu coba lagi.';
      }

      return {
        ok: false,
        code,
        message,
        isUnauthorizedDomain,
        isPopupBlocked,
        isClosedByUser,
        isEmbeddedIframe,
      };
    })
    .finally(() => {
      googlePopupPromise = null;
    });

  return googlePopupPromise;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
