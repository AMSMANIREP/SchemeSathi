import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

// Wrangler's local worker does not inherit arbitrary container environment
// variables. Supply them through its runtime secret file, not build-time vars.
const bindings = [
  'DATA_STORAGE_MODE',
  'POSTGRES_SERVICE_URL',
  'POSTGRES_SERVICE_API_KEY',
  'STORAGE_SYNC_KEY',
];
let local = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8') : '';
for (const name of bindings) {
  if (process.env[name] === undefined) continue;
  local = local
    .split(/\r?\n/)
    .filter((line) => !new RegExp('^\\s*' + name + '\\s*=').test(line))
    .join('\n');
  local += '\n' + name + '=' + JSON.stringify(process.env[name]) + '\n';
}
writeFileSync('.dev.vars', local, { mode: 0o600 });

function run(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function migrate(file) {
  run([
    'exec',
    'wrangler',
    'd1',
    'execute',
    'site-creator-d1',
    '--local',
    '--config',
    'dist/server/wrangler.json',
    '--persist-to',
    '.wrangler/state',
    '--file',
    file,
  ]);
}

run(['build']);
mkdirSync('.wrangler', { recursive: true });
if (!existsSync('.wrangler/.schema-ready')) {
  migrate('drizzle/0000_old_power_pack.sql');
  migrate('scripts/sql/local_session_and_conversation_fields.sql');
  writeFileSync('.wrangler/.schema-ready', '');
}
// Idempotent, so existing volumes receive new tables/triggers on upgrade.
migrate('drizzle/0007_storage_mirror.sql');

const server = spawn(
  'pnpm',
  ['dev', '--hostname', '0.0.0.0', '--port', '3000'],
  { stdio: 'inherit' },
);
process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));
server.on('error', (error) => {
  throw error;
});
server.on('exit', (code) => process.exit(code ?? 1));
