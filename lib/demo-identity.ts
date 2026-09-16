/** Demo identifiers are browser-local selectors, never authentication. */
export function normalizeDemoEmail(value: string) {
  const email = value.trim().normalize('NFKC').toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email for this demo profile.');
  return email;
}

export async function demoProfileKey(email: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalizeDemoEmail(email)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
