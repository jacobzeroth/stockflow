// Local Postgres for development only. Not used in production.
// Usage: npm run db:local  (leave running in its own terminal)
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.LOCAL_PG_PORT ?? 55432);
const database = "stockflow";

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  autoRehydrateSymlinks: true,
  onLog: () => {},
});

try {
  await pg.initialise();
} catch (error) {
  if (!/already|exists|not empty/i.test(String(error?.message ?? error))) {
    console.error(error);
    process.exit(1);
  }
}

await pg.start();

try {
  await pg.createDatabase(database);
} catch {
  // already created on a previous run
}

console.log(`DATABASE_URL=postgresql://postgres:postgres@localhost:${port}/${database}`);
console.log("Local Postgres ready. Press Ctrl+C to stop.");

const shutdown = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
