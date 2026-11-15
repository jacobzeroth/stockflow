type Executor = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export async function audit(
  exec: Executor,
  user: { id: string; name: string } | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: unknown
): Promise<void> {
  await exec.query(
    `insert into audit_log (id, user_id, user_name, action, entity, entity_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      crypto.randomUUID(),
      user?.id ?? null,
      user?.name ?? "system",
      action,
      entity,
      entityId,
      detail === undefined ? null : JSON.stringify(detail).slice(0, 2000),
    ]
  );
}

export function safeRedirect(value: unknown, fallback: string): string {
  const target = String(value ?? "");
  if (target.startsWith("/") && !target.startsWith("//")) return target;
  return fallback;
}

export function withFlash(path: string, key: "ok" | "error", message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}
