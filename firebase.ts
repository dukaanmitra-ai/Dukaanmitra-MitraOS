import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export const EXPECTED_FIREBASE_PROJECT_ID = "mvp1-aafa3" as const;

export const REQUIRED_FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export type RequiredFirebaseEnvKey = (typeof REQUIRED_FIREBASE_ENV_KEYS)[number];

export interface FirebaseEnvSource {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
}

export interface FirebaseConfigValidationResult {
  isConfigured: boolean;
  config: FirebaseOptions | null;
  projectId: string | null;
  missingKeys: RequiredFirebaseEnvKey[];
  error: string | null;
}

export class FirebaseConfigError extends Error {
  readonly code: "FIREBASE_NOT_CONFIGURED" | "FIREBASE_PROJECT_MISMATCH";
  readonly missingKeys: RequiredFirebaseEnvKey[];

  constructor(
    code: "FIREBASE_NOT_CONFIGURED" | "FIREBASE_PROJECT_MISMATCH",
    message: string,
    missingKeys: RequiredFirebaseEnvKey[] = [],
  ) {
    super(message);
    this.name = "FirebaseConfigError";
    this.code = code;
    this.missingKeys = missingKeys;
  }
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "demo-api-key",
  "dukaanmitra-demo",
  "your_firebase_api_key",
  "your-project-id",
  "your_sender_id",
  "your_app_id",
]);

function readCleanEnvValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) return undefined;
  return trimmed;
}

/**
 * Validates Vite environment variables for Firebase project `mvp1-aafa3`.
 * Pure function so it can be unit tested deterministically without side effects.
 */
export function validateFirebaseConfig(
  env: FirebaseEnvSource,
): FirebaseConfigValidationResult {
  const missingKeys: RequiredFirebaseEnvKey[] = [];

  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    if (!readCleanEnvValue(env[key])) {
      missingKeys.push(key);
    }
  }

  const projectId = readCleanEnvValue(env.VITE_FIREBASE_PROJECT_ID) ?? null;

  if (missingKeys.length > 0) {
    return {
      isConfigured: false,
      config: null,
      projectId,
      missingKeys,
      error: `Firebase configuration is incomplete. Missing required Vite env var(s): ${missingKeys.join(", ")}.`,
    };
  }

  if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    return {
      isConfigured: false,
      config: null,
      projectId,
      missingKeys: [],
      error: `Invalid VITE_FIREBASE_PROJECT_ID "${projectId}". MitraOS must bind to Firebase project "${EXPECTED_FIREBASE_PROJECT_ID}".`,
    };
  }

  const measurementId = readCleanEnvValue(env.VITE_FIREBASE_MEASUREMENT_ID);

  const config: FirebaseOptions = {
    apiKey: readCleanEnvValue(env.VITE_FIREBASE_API_KEY)!,
    authDomain: readCleanEnvValue(env.VITE_FIREBASE_AUTH_DOMAIN)!,
    projectId: EXPECTED_FIREBASE_PROJECT_ID,
    storageBucket: readCleanEnvValue(env.VITE_FIREBASE_STORAGE_BUCKET)!,
    messagingSenderId: readCleanEnvValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID)!,
    appId: readCleanEnvValue(env.VITE_FIREBASE_APP_ID)!,
    ...(measurementId ? { measurementId } : {}),
  };

  return {
    isConfigured: true,
    config,
    projectId: EXPECTED_FIREBASE_PROJECT_ID,
    missingKeys: [],
    error: null,
  };
}

const runtimeEnv: FirebaseEnvSource =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env as unknown as FirebaseEnvSource)
    : {};

export const firebaseConfigStatus: FirebaseConfigValidationResult =
  validateFirebaseConfig(runtimeEnv);

export const isFirebaseConfigured: boolean = firebaseConfigStatus.isConfigured;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function initFirebaseOnce(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!firebaseConfigStatus.isConfigured || !firebaseConfigStatus.config) {
    return null;
  }

  if (!cachedApp) {
    cachedApp =
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfigStatus.config);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  if (!cachedDb) {
    cachedDb = getFirestore(cachedApp);
  }

  return { app: cachedApp, auth: cachedAuth, db: cachedDb };
}

const initialized = initFirebaseOnce();

export const firebaseApp: FirebaseApp | null = initialized?.app ?? null;
export const auth: Auth | null = initialized?.auth ?? null;
export const db: Firestore | null = initialized?.db ?? null;

function throwConfigError(): never {
  if (
    firebaseConfigStatus.projectId &&
    firebaseConfigStatus.projectId !== EXPECTED_FIREBASE_PROJECT_ID &&
    firebaseConfigStatus.missingKeys.length === 0
  ) {
    throw new FirebaseConfigError(
      "FIREBASE_PROJECT_MISMATCH",
      firebaseConfigStatus.error ??
        `Expected Firebase project "${EXPECTED_FIREBASE_PROJECT_ID}".`,
    );
  }
  throw new FirebaseConfigError(
    "FIREBASE_NOT_CONFIGURED",
    firebaseConfigStatus.error ??
      "Firebase is not configured. Provide VITE_FIREBASE_* environment variables.",
    firebaseConfigStatus.missingKeys,
  );
}

/**
 * Returns the initialized Firebase App instance or throws a typed FirebaseConfigError.
 */
export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  throwConfigError();
}

/**
 * Returns the initialized Firebase Auth instance or throws a typed FirebaseConfigError.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  throwConfigError();
}

/**
 * Returns the initialized Cloud Firestore instance or throws a typed FirebaseConfigError.
 */
export function getFirebaseDb(): Firestore {
  if (db) return db;
  throwConfigError();
}
