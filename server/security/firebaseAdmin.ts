import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const AUTHORITATIVE_PROJECT_ID = "mvp1-aafa3";

export class ServerSecurityError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly safeMessage: string;

  constructor(
    statusCode: number,
    code: string,
    safeMessage: string,
    internalMessage?: string,
  ) {
    super(internalMessage ?? safeMessage);
    this.name = "ServerSecurityError";
    this.statusCode = statusCode;
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

export interface FirebaseAdminBundle {
  app: App;
  auth: Auth;
  db: Firestore;
  projectId: string;
}

let cachedBundle: FirebaseAdminBundle | null = null;

function parseServiceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount & {
      project_id?: string;
      private_key?: string;
    };
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Service account JSON must be an object.");
    }
    const projectId = parsed.projectId ?? parsed.project_id;
    if (projectId && projectId !== AUTHORITATIVE_PROJECT_ID) {
      throw new ServerSecurityError(
        500,
        "ADMIN_PROJECT_MISMATCH",
        "Authentication service misconfigured.",
        `Refusing Firebase Admin init for project "${projectId}"; expected "${AUTHORITATIVE_PROJECT_ID}".`,
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof ServerSecurityError) throw error;
    throw new ServerSecurityError(
      500,
      "ADMIN_CONFIG_INVALID",
      "Authentication service misconfigured.",
      "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON.",
    );
  }
}

/**
 * Lazily initializes Firebase Admin SDK bound strictly to `mvp1-aafa3`.
 * Never reads browser credentials; fails closed if credentials are not available.
 */
export function getFirebaseAdmin(): FirebaseAdminBundle {
  if (cachedBundle) return cachedBundle;

  const configuredProjectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || AUTHORITATIVE_PROJECT_ID;
  if (configuredProjectId !== AUTHORITATIVE_PROJECT_ID) {
    throw new ServerSecurityError(
      500,
      "ADMIN_PROJECT_MISMATCH",
      "Authentication service misconfigured.",
      `FIREBASE_PROJECT_ID must be "${AUTHORITATIVE_PROJECT_ID}".`,
    );
  }

  let app: App;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    const serviceAccount = parseServiceAccountFromEnv();
    if (serviceAccount) {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: AUTHORITATIVE_PROJECT_ID,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: AUTHORITATIVE_PROJECT_ID,
      });
    } else {
      throw new ServerSecurityError(
        503,
        "ADMIN_NOT_CONFIGURED",
        "Server authentication backend is not configured.",
        "Neither FIREBASE_SERVICE_ACCOUNT_KEY nor Application Default Credentials are configured.",
      );
    }
  }

  cachedBundle = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    projectId: AUTHORITATIVE_PROJECT_ID,
  };
  return cachedBundle;
}

export function isFirebaseAdminAvailable(): boolean {
  try {
    getFirebaseAdmin();
    return true;
  } catch {
    return false;
  }
}

export function resetFirebaseAdminCacheForTests(): void {
  cachedBundle = null;
}
