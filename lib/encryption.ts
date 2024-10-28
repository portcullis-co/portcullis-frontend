import * as jose from 'jose';

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'your-secret-key-minimum-32-characters!!';

export async function encrypt(data: any): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(SECRET_KEY);
  
  const jwt = await new jose.EncryptJWT({ data })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .encrypt(secretKey);
  
  return jwt;
}

export async function decrypt(token: string): Promise<any> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(SECRET_KEY);
  
  const { payload } = await jose.jwtDecrypt(token, secretKey);
  return payload.data;
}