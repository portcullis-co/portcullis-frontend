import crypto from 'crypto';

export async function generateApiKey(orgId: string) {
    const randomBytes = crypto.randomBytes(32);
    const apiKey = `pk_${randomBytes.toString('base64url')}`;
    return apiKey;
  }