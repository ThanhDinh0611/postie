export async function generatePresignedUrl(
  key: string,
  env: {
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ACCOUNT_ID: string;
  },
  expiresInSeconds: number = 3600,
): Promise<string> {
  const bucket = 'postie-images';
  const endpoint = `https://${bucket}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);

  const httpMethod = 'GET';
  const canonicalUri = `/${key}`;
  const signedHeaders = 'host';

  const algorithm = 'AWS4-HMAC-SHA256';
  const credential = `${env.R2_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': credential,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  const canonicalQuerystring = params.toString();

  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQuerystring,
    `host:${bucket}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    algorithm,
    datetime,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const signingKey = await getSigningKey(env.R2_SECRET_ACCESS_KEY, date, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const url = `${endpoint}/${encodeURIComponent(key)}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
  return url;
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(hash));
}

async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const hash = await hmacSha256(key, message);
  return bytesToHex(new Uint8Array(hash));
}

async function getSigningKey(
  secretAccessKey: string,
  date: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    date,
  );
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
