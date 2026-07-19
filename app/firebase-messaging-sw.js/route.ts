// Served at /firebase-messaging-sw.js (root scope, where the Firebase
// client SDK expects to find it by default). A route handler rather than a
// static public/ file so it can read the same NEXT_PUBLIC_FIREBASE_* config
// used everywhere else -- one source of truth, no build step to keep a
// static copy in sync.
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const script = `importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "RDV", { body: body || "" });
});
`;

  return new Response(script, {
    headers: { "Content-Type": "application/javascript" },
  });
}
