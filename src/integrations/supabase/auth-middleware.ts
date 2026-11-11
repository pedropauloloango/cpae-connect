import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  getProjectRefFromSupabaseUrl,
  verifySupabaseAccessToken,
} from "./verify-jwt";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
    const SUPABASE_JWT_PUBLIC_KEY = process.env.SUPABASE_JWT_PUBLIC_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Configure .env (see .env.example).`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const hasLocalJwtKey = Boolean(SUPABASE_JWT_SECRET?.trim() || SUPABASE_JWT_PUBLIC_KEY?.trim());

    const request = getRequest();
    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let userId: string;

    try {
      if (hasLocalJwtKey) {
        const claims = verifySupabaseAccessToken(token, {
          jwtSecret: SUPABASE_JWT_SECRET,
          jwtPublicKey: SUPABASE_JWT_PUBLIC_KEY,
        });
        const expectedRef = getProjectRefFromSupabaseUrl(SUPABASE_URL);
        if (expectedRef && claims.ref && claims.ref !== expectedRef) {
          throw new Error("Token belongs to a different Supabase project");
        }
        userId = claims.sub;
      } else {
        // Sem chave JWT no ambiente: valida o token no próprio Supabase Auth.
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
          throw new Error(error?.message ?? "Usuário não encontrado para o token");
        }
        userId = data.user.id;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "verification failed";
      console.error("[Supabase auth] JWT verify failed:", detail);
      throw new Error("Unauthorized: Invalid token. Faça logout e entre novamente.");
    }

    return next({
      context: {
        supabase,
        userId,
      },
    });
  },
);
