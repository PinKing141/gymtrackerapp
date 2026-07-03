// One-time helper: prints a VAPID public/private key pair.
//
//   cd server && npm install && npm run generate-keys
//
// - Put the PUBLIC key in the web app env as VITE_VAPID_PUBLIC_KEY.
// - Put BOTH keys in your server/CI secrets as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY =", keys.publicKey);
console.log("VAPID_PRIVATE_KEY =", keys.privateKey);
