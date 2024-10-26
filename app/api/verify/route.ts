import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export async function POST(request: Request) {
  const body = await request.json();
  console.log('Received request body:', body);
  const { seedPhrase, token } = body;

  if (!seedPhrase || !token) {
    console.log('Missing seedPhrase or token:', { seedPhrase, token });
    return NextResponse.json({ error: 'Missing seedPhrase or token' }, { status: 400 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('links')
    .select('hashedPhrase')
    .eq('invite_token', token)
    .single();

  if (error) {
    console.error('Supabase error:', error);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  if (!data || !data.hashedPhrase) {
    console.log('No data or hashedPhrase found for token:', token);
    return NextResponse.json({ error: 'No hashed phrase found for this token' }, { status: 400 });
  }

  const hashedInputPhrase = crypto.createHash('sha256').update(seedPhrase).digest('hex');

  console.log('Comparison:', {
    hashedInputPhrase,
    storedHash: data.hashedPhrase,
    isMatch: hashedInputPhrase === data.hashedPhrase
  });

  const isMatch = hashedInputPhrase === data.hashedPhrase;
  if (isMatch) {
    return NextResponse.json({ verified: true });
  } else {
    console.log('Verification failed. Input hash:', hashedInputPhrase, 'Stored hash:', data.hashedPhrase);
    return NextResponse.json({ verified: false }, { status: 400 });
  }
}
