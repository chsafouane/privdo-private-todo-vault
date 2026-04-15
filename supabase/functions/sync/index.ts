import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHANNEL_ID_REGEX = /^[a-f0-9]{64}$/;
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

// Simple in-memory rate limiter (per isolate; resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window

function isRateLimited(channelId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(channelId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(channelId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return jsonResponse(null, 204);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { action, channelId, encryptedData, deviceId, version } = body;

    // Validate channelId format (must be a 64-char hex string = SHA-256 hash)
    if (!channelId || !CHANNEL_ID_REGEX.test(channelId)) {
      return jsonResponse({ error: "Invalid channelId" }, 400);
    }

    // Rate limit
    if (isRateLimited(channelId)) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "pull") {
      const { data, error } = await supabase
        .from("sync_blobs")
        .select("encrypted_data, version, device_id, updated_at")
        .eq("channel_id", channelId)
        .maybeSingle();

      if (error) {
        return jsonResponse({ error: "Database error" }, 500);
      }

      if (!data) {
        return jsonResponse({ exists: false });
      }

      return jsonResponse({
        exists: true,
        encryptedData: data.encrypted_data,
        version: data.version,
        deviceId: data.device_id,
        updatedAt: data.updated_at,
      });
    }

    if (action === "push") {
      if (!encryptedData || typeof encryptedData !== "string") {
        return jsonResponse({ error: "Missing encryptedData" }, 400);
      }
      if (encryptedData.length > MAX_PAYLOAD_SIZE) {
        return jsonResponse({ error: "Payload too large" }, 413);
      }
      if (!deviceId || typeof deviceId !== "string" || deviceId.length > 128) {
        return jsonResponse({ error: "Invalid deviceId" }, 400);
      }
      if (typeof version !== "number" || version < 0) {
        return jsonResponse({ error: "Invalid version" }, 400);
      }

      // Check current version for optimistic concurrency
      const { data: existing } = await supabase
        .from("sync_blobs")
        .select("version")
        .eq("channel_id", channelId)
        .maybeSingle();

      if (existing) {
        if (version !== existing.version) {
          return jsonResponse(
            { error: "Version conflict", serverVersion: existing.version },
            409
          );
        }
        // Atomic update: include version in WHERE to prevent TOCTOU race
        const { data: updated, error } = await supabase
          .from("sync_blobs")
          .update({
            encrypted_data: encryptedData,
            version: existing.version + 1,
            device_id: deviceId,
            updated_at: new Date().toISOString(),
          })
          .eq("channel_id", channelId)
          .eq("version", existing.version)
          .select("version")
          .maybeSingle();

        if (error) {
          return jsonResponse({ error: "Database error" }, 500);
        }
        if (!updated) {
          return jsonResponse(
            { error: "Version conflict", serverVersion: existing.version },
            409
          );
        }

        return jsonResponse({ ok: true, version: existing.version + 1 });
      } else {
        // New channel: insert
        const { error } = await supabase.from("sync_blobs").insert({
          channel_id: channelId,
          encrypted_data: encryptedData,
          version: 1,
          device_id: deviceId,
        });

        if (error) {
          return jsonResponse({ error: "Database error" }, 500);
        }

        return jsonResponse({ ok: true, version: 1 });
      }
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
});
