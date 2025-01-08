import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(req: Request) {
  try {
    const { monthlyPrice, meteredPrice, organizationId } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: monthlyPrice,
          quantity: 1,
        },
        {
            price: meteredPrice,
            quantity: 1,
          },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/portal?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/portal?canceled=true`,
      metadata: {
        organizationId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Error creating checkout session' }, { status: 500 });
  }
}