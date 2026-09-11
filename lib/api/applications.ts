import { body, db, external, HttpError, json, settings } from "../http";
import { evaluateScheme, redact } from "../rules";
import { schemes } from "../schemes";
import type { SessionRoute } from "../session";

const statuses = [
  "Interested",
  "Preparing documents",
  "Submitted",
  "Under review",
  "Action required",
  "Approved",
  "Closed",
];

async function ruleService(
  req: Request,
  method: string,
  path: string,
  data?: unknown,
) {
  const { RULE_SERVICE_URL, RULE_SERVICE_API_KEY, SERVICE_API_KEY } =
    settings();
  const serviceKey = RULE_SERVICE_API_KEY || SERVICE_API_KEY;
  if (!RULE_SERVICE_URL || !serviceKey) return null;
  const response = await external(RULE_SERVICE_URL.replace(/\/$/, "") + path, {
    method,
    headers: {
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return json(await response.json(), response.status);
}

export const applications: SessionRoute = async ({
  req,
  p,
  path,
  method,
  s,
}) => {
  const servicePath =
    p === "applications"
      ? "/v1/applications"
      : "/v1/applications/" + encodeURIComponent(path[1]);

  if (p === "applications" && method === "GET") {
    const response = await ruleService(
      req,
      method,
      servicePath + "?sessionId=" + encodeURIComponent(s.id),
    );
    if (response) return response;
    const r = await db()
      .prepare(
        "SELECT * FROM applications WHERE owner=? ORDER BY updated_at DESC",
      )
      .bind(s.id)
      .all<Record<string, unknown>>();
    return json({
      applications: r.results.map((a) => ({
        id: a.id,
        schemeId: a.scheme_id,
        status: a.status,
        reference: a.reference,
        notes: a.notes,
        checklist: JSON.parse(a.checklist as string),
        updatedAt: a.updated_at,
      })),
    });
  }

  if (p === "applications" && method === "POST") {
    const b = await body(req);
    const response = await ruleService(req, method, servicePath, {
      sessionId: s.id,
      schemeId: b.schemeId,
    });
    if (response) return response;
    const scheme = (await schemes()).find((x) => x.id === b.schemeId);
    if (!scheme) throw new HttpError(400, "Unknown scheme.");
    // Freeze the verdict at save time. The report is built from this, so a
    // later profile edit cannot silently rewrite a document already printed.
    const decision = evaluateScheme(
      scheme,
      JSON.parse(s.profile),
      JSON.parse(s.confirmed),
    );
    await db()
      .prepare(
        "INSERT INTO applications(id,owner,scheme_id,decision_snapshot,scheme_version,conversation_id,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,scheme_id) DO NOTHING",
      )
      .bind(
        crypto.randomUUID(),
        s.id,
        b.schemeId,
        JSON.stringify(decision),
        scheme.version,
        typeof b.conversationId === "string" ? b.conversationId : null,
        new Date().toISOString(),
      )
      .run();
    return json({ saved: true }, 201);
  }

  if (p.startsWith("applications/") && ["PATCH", "DELETE"].includes(method)) {
    const b = method === "PATCH" ? await body(req) : undefined;
    const response = await ruleService(
      req,
      method,
      servicePath +
        (method === "DELETE" ? "?sessionId=" + encodeURIComponent(s.id) : ""),
      method === "PATCH" ? { ...b, sessionId: s.id } : undefined,
    );
    if (response) return response;
    const existing = await db()
      .prepare("SELECT id,scheme_id FROM applications WHERE id=? AND owner=?")
      .bind(path[1], s.id)
      .first<{ id: string; scheme_id: string }>();
    if (!existing) throw new HttpError(404, "Application record not found.");

    if (method === "DELETE") {
      await db()
        .prepare("DELETE FROM applications WHERE id=? AND owner=?")
        .bind(path[1], s.id)
        .run();
      return json({ deleted: true });
    }

    const patch = b as Record<string, unknown>;
    if (typeof patch.status !== "string" || !statuses.includes(patch.status))
      throw new HttpError(400, "Invalid status.");
    if (
      typeof patch.notes !== "string" ||
      patch.notes.length > 600 ||
      typeof patch.reference !== "string" ||
      patch.reference.length > 80 ||
      !Array.isArray(patch.checklist) ||
      patch.checklist.length > 20 ||
      patch.checklist.some(
        (v: unknown) => typeof v !== "string" || v.length > 400,
      )
    )
      throw new HttpError(400, "Invalid record values.");
    // The checklist stores each document's `item` text, unchanged by the
    // structured-catalogue migration, so rows saved before it stay valid.
    const allowed = (
      (await schemes()).find((x) => x.id === existing.scheme_id)?.documents ||
      []
    ).map((d) => d.item);
    if (
      patch.checklist.some((x: string) => !allowed.includes(x)) ||
      new Set(patch.checklist).size !== patch.checklist.length
    )
      throw new HttpError(400, "Choose checklist items from this scheme.");
    const reference = patch.reference
      ? "•••• " + patch.reference.replace(/[^a-zA-Z0-9]/g, "").slice(-4)
      : "";
    await db()
      .prepare(
        "UPDATE applications SET status=?,reference=?,notes=?,checklist=?,updated_at=? WHERE id=? AND owner=?",
      )
      .bind(
        patch.status,
        reference,
        redact(patch.notes),
        JSON.stringify(patch.checklist),
        new Date().toISOString(),
        path[1],
        s.id,
      )
      .run();
    return json({ saved: true });
  }

  return null;
};
