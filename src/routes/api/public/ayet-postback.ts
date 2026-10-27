import { createFileRoute } from "@tanstack/react-router";

/**
 * Ayet Studios offerwall postback receiver.
 *
 * Configure in the Ayet publisher dashboard (placement → Callback URL):
 *   https://<your-domain>/api/public/ayet-postback?network=ayetstudios&amount={currency_amount}&external_identifier={external_identifier}&payout_usd={payout_usd}&transaction_id={transaction_id}
 *
 * Security: Ayet sends an `X-Ayetstudios-Security-Hash` header containing a
 * SHA-256 HMAC of the alphabetically-sorted query string keyed by the
 * publisher API key (secret AYET_PUBLISHER_API_KEY). The callback is only
 * accepted when that hash matches. Must always answer HTTP 200 on success,
 * otherwise Ayet retries the postback for an hour.
 *
 * Docs: https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/
 */
export const Route = createFileRoute("/api/public/ayet-postback")({
  server: {
    handlers: {
      GET: handlePostback,
    },
  },
});

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handlePostback({ request }: { request: Request }) {
  const apiKey = process.env["AYET_PUBLISHER_API_KEY"];
  if (!apiKey) {
    return new Response("AYET_PUBLISHER_API_KEY is not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  // --- 1. Verify the security hash header ---------------------------------
  const receivedHash = (request.headers.get("x-ayetstudios-security-hash") ?? "").toLowerCase();
  if (!receivedHash) {
    return new Response("Missing X-Ayetstudios-Security-Hash header", { status: 401 });
  }
  const sorted = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  const computedHash = await hmacSha256Hex(sorted.toString(), apiKey);
  if (computedHash !== receivedHash) {
    return new Response("Invalid security hash", { status: 401 });
  }

  // --- 2. Extract callback fields ------------------------------------------
  const userId = params.get("external_identifier");
  const amount = Number(params.get("amount"));
  const txId = params.get("transaction_id") ?? params.get("tx_id");
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "missing or invalid parameters" }, { status: 400 });
  }
  // Deterministic idempotency key when the network omits a transaction id:
  // identical retried postbacks collapse into a single credit.
  const effectiveTxId = txId ?? `auto-${computedHash}`;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin;

  // --- 3. Reversal callbacks (chargebacks): transaction id prefixed "r-" ---
  if (effectiveTxId.startsWith("r-")) {
    const originalId = effectiveTxId.slice(2);
    const { data: original } = await admin
      .from("offerwall_transactions")
      .select("user_id, points")
      .eq("tx_id", originalId)
      .maybeSingle();
    if (!original) {
      return Response.json({ ok: true, note: "reversal origin not found" });
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("points, total_earned_points")
      .eq("id", original.user_id)
      .maybeSingle();
    const deduct = Math.min(original.points, profile?.points ?? 0);
    if (deduct > 0) {
      await admin
        .from("profiles")
        .update({
          points: (profile!.points ?? 0) - deduct,
          total_earned_points: Math.max((profile!.total_earned_points ?? 0) - deduct, 0),
        })
        .eq("id", original.user_id);
    }
    await admin
      .from("offerwall_transactions")
      .upsert({ tx_id: effectiveTxId, user_id: original.user_id, points: -deduct });
    return Response.json({ ok: true, reversal: true });
  }

  // --- 4. Idempotent credit --------------------------------------------------
  const points = Math.floor(amount);
  const { data: inserted, error: insertError } = await admin
    .from("offerwall_transactions")
    .upsert(
      { tx_id: effectiveTxId, user_id: userId, points },
      { onConflict: "tx_id", ignoreDuplicates: true },
    )
    .select("tx_id");
  if (insertError) {
    console.error("ayet postback insert failed:", insertError.message);
    return new Response("database error", { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    return Response.json({ ok: true, note: "already processed" });
  }

  const { error: creditError } = await admin.rpc("credit_offerwall_points", {
    p_user_id: userId,
    p_points: points,
  });
  if (creditError) {
    console.error("ayet postback credit failed:", creditError.message);
    return new Response("credit failed", { status: 500 });
  }

  return Response.json({ ok: true, credited: points });
}
