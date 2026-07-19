import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

// Lazily instantiated, same reasoning as lib/stripe.ts's getStripe(): Next.js
// evaluates route/action modules at build time to collect page data, which
// would otherwise construct a real Firebase Admin client (and throw on
// missing credentials) before any request ever needs one.
let adminApp: App | null | undefined;

function getFirebaseAdminApp(): App | null {
  if (adminApp !== undefined) return adminApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    adminApp = null;
    return null;
  }

  adminApp = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  return adminApp;
}

// Returns null when no Firebase project is configured yet -- lib/push.ts
// falls back to logging instead of sending, the same way lib/email.ts does
// when RESEND_API_KEY is unset.
export function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseAdminApp();
  return app ? getMessaging(app) : null;
}
