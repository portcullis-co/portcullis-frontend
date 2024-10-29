import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { encrypt } from '@/lib/encryption';

type Link = {
  id: string;
  invite_token: string;
  internal_warehouse: string;
  logo: string | null;
  redirect_url: string | null;
  recipient_email: string;
  organization: string;
  encrypted_password: string;
  created_at: string;  // Make sure this exists
};

const resend = new Resend('re_CAiLvhVL_Hq6K3xEkCsqMAe77JS1m5Gdm');
type CreateLinkInput = z.infer<typeof createLinkSchema>;

const createLinkSchema = z.object({
  organizationId: z.string().nonempty('Organization ID is required'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  redirectUrl: z.string().url('Invalid redirect URL'),
  internal_warehouse: z.string().nonempty('Warehouse selection is required'),
  recipient_email: z.string().email('Invalid email address'),
  domain: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { logo, redirectUrl, internal_warehouse, recipient_email, password } = await request.json();
    const encrypted_password = await encrypt(password);

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const invite_token = nanoid(10);

    const { data, error } = await supabase
      .from('links')
      .insert({ 
        invite_token,
        internal_warehouse,
        logo,
        creator: userId,
        redirect_url: redirectUrl,
        recipient_email,
        organization: orgId,
        encrypted_password: encrypted_password,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const internal_logo = "https://portcullis-app.fly.dev/portcullis.svg"
    // Send email using Resend
    const emailHtml = ``;

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: recipient_email,
        subject: 'Confirm your email address',
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Note: We're not returning here, as we still want to return the data even if email sending fails
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createClient();
  const { userId, orgId } = auth();

  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('links')
    .select(`
      id,
      invite_token,
      internal_warehouse,
      logo,
      redirect_url,
      recipient_email,
      organization,
      encrypted_password,
      created_at
    `)
    .eq('creator', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform the data to ensure dates are properly formatted
  const formattedData = data?.map(link => ({
    ...link,
    createdAt: link.created_at, // Map created_at to createdAt for frontend consistency
  }));

  return NextResponse.json(formattedData);
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { userId, orgId } = auth();
    const { id } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: No organization ID' }, { status: 401 });
    }

    const { error } = await supabase
      .from('links')
      .delete()
      .match({ id, organization: orgId });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}