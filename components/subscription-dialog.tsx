"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type DialogStep = 'plan' | 'confirm' | 'loading' | 'checkout';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

interface SubscriptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId?: string;
  }

export default function SubscriptionDialog({ 
    open, 
    onOpenChange,
    organizationId 
  }: SubscriptionDialogProps) {
    const [step, setStep] = useState<DialogStep>('plan');
    const [error, setError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
  
    const handleSubscribeClick = async () => {
      try {
        setError(null);
        setStep('loading');
        
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meteredPrice: 'price_1QfGitGSPDCwljL7WaxYfMF8',
            organizationId,
          }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create checkout session');
        }
  
        const { clientSecret } = await response.json();
        
        if (clientSecret) {
          setClientSecret(clientSecret);
          setStep('checkout');
        } else {
          throw new Error('No client secret received');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
        setStep('plan');
      }
    };

    const renderContent = () => {
      switch (step) {
        case 'plan':
          return (
            <>
              <DialogHeader>
                <DialogTitle>Choose Your Subscription Plan</DialogTitle>
                <DialogDescription>
                  Select a plan to access all features
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="mt-6">
                <div className="rounded-lg border p-4 mb-4">
                  <h3 className="font-semibold mb-2">Enterprise Plan</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>✓ Multi-Warehouse Support</li>
                    <li>✓ Enterprise-Grade Security</li>
                    <li>✓ Sync Update Notifications</li>
                    <li>✓ Priority Support</li>
                  </ul>
                  <p className="mt-4 text-sm text-gray-600">
                    Starting at $499/month + usage
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('confirm')}>
                  Continue to Checkout
                </Button>
              </DialogFooter>
            </>
          );

        case 'confirm':
          return (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Subscription</DialogTitle>
                <DialogDescription>
                  Please review your subscription details
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Flexible Plan</h4>
                  <div className="text-sm text-gray-600">
                    <p>Base price: $4500/month</p>
                    <p>Usage: $0.09 per 1000 requests</p>
                  </div>
                </div>
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    You'll be redirected to Stripe to complete your purchase
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setStep('plan')}>
                  Back
                </Button>
                <Button onClick={handleSubscribeClick}>
                  Proceed to Payment
                </Button>
              </DialogFooter>
            </>
          );

        case 'loading':
          return (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <p className="text-sm text-gray-600">
                Preparing your checkout session...
              </p>
            </div>
          );

          case 'checkout':
            return (
                <div className="flex items-center justify-center min-h-[80vh] bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 overflow-hidden">
                    {clientSecret ? (
                    <EmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={{
                        clientSecret,
                        }}
                    >
                        <div className="h-[80vh] overflow-y-auto">
                        <EmbeddedCheckout />
                        </div>
                    </EmbeddedCheckoutProvider>
                    ) : (
                    <p className="text-center text-sm text-gray-600">
                        Missing client secret for checkout.
                    </p>
                    )}
                </div>
                </div>
            );
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          {renderContent()}
        </DialogContent>
      </Dialog>
    );
}
