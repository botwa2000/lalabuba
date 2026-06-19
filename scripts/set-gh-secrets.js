// One-off: set GitHub Actions repo secrets for the Hetzner deploy workflow.
// Encrypts each value with the repo's Actions public key (libsodium sealed box,
// as GitHub requires) and PUTs it. Reads everything from env so no secret value
// is ever passed on argv or printed. Run via set-gh-secrets.sh.
//
//   GH_TOKEN       — PAT with repo + Secrets:write
//   GH_REPO        — owner/repo (e.g. botwa2000/lalabuba)
//   SECRET_<NAME>  — one env var per secret to set (prefix stripped → secret name)
const sodium = require('libsodium-wrappers');

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO;
if (!TOKEN || !REPO) { console.error('missing GH_TOKEN/GH_REPO'); process.exit(1); }

const API = `https://api.github.com/repos/${REPO}/actions/secrets`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'lala-secret-setter',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function main() {
  await sodium.ready;

  const pkRes = await fetch(`${API}/public-key`, { headers });
  if (!pkRes.ok) { console.error(`public-key fetch failed: HTTP ${pkRes.status}`); process.exit(1); }
  const { key, key_id } = await pkRes.json();
  const pkBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  const names = Object.keys(process.env)
    .filter((k) => k.startsWith('SECRET_'))
    .map((k) => k.slice('SECRET_'.length));

  if (!names.length) { console.error('no SECRET_* env vars provided'); process.exit(1); }

  for (const name of names) {
    const value = process.env[`SECRET_${name}`] || '';
    const sealed = sodium.crypto_box_seal(sodium.from_string(value), pkBytes);
    const encrypted_value = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
    const res = await fetch(`${API}/${name}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted_value, key_id }),
    });
    // 201 = created, 204 = updated. Never log the value, only the status.
    console.log(`${name}: HTTP ${res.status} ${res.status === 201 ? '(created)' : res.status === 204 ? '(updated)' : '(FAILED)'}`);
    if (res.status >= 400) { console.error(await res.text()); process.exit(1); }
  }
  console.log('done');
}
main().catch((e) => { console.error('error:', e.message); process.exit(1); });
