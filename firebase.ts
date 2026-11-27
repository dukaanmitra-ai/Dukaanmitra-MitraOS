import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

interface FirebaseAppletConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

// Optional local Firebase applet config (loaded if present, ignored cleanly if gitignored)
const localConfigs = import.meta.glob<{ default: FirebaseAppletConfig }>(
  "./firebase-applet-config.json",
  { eager: true },
);
const fileConfig: FirebaseAppletConfig =
  localConfigs["./firebase-applet-config.json"]?.default ?? {};

const firebaseConfig = {
  apiKey:
    fileConfig.apiKey ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "demo-api-key",
  authDomain:
    fileConfig.authDomain ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "dukaanmitra-demo.firebaseapp.com",
  projectId:
    fileConfig.projectId ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    "dukaanmitra-demo",
  storageBucket:
    fileConfig.storageBucket ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "dukaanmitra-demo.appspot.com",
  messagingSenderId:
    fileConfig.messagingSenderId ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "000000000000",
  appId:
    fileConfig.appId ||
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:000000000000:web:0000000000000000000000",
};

const databaseId =
  fileConfig.firestoreDatabaseId ||
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  "(default)";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
