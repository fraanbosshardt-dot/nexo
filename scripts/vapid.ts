// Genera las claves para los avisos en el celular. Uso: npm run vapid
// Copiá las dos líneas en Vercel (Settings → Environment Variables) y agregá VAPID_SUBJECT con tu correo (mailto:...).
import { generateVapidKeys } from "../src/server/push";

const k = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
