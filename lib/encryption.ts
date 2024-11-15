import * as jose from 'jose';

// Helper function to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
}

const SECRET_KEY = process.env.ENCRYPTION_KEY!;  // Non-null assertion

export async function encrypt(data: any): Promise<string> {
  const secretKey = hexToBytes(SECRET_KEY); // Convert hex string to byte array
  
  const jwt = await new jose.EncryptJWT({ data })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .encrypt(secretKey);

  return jwt;
}

export async function decrypt(token: string): Promise<any> {
  const secretKey = hexToBytes(SECRET_KEY); // Convert hex string to byte array
  
  const { payload } = await jose.jwtDecrypt(token, secretKey);
  return payload.data;
}
