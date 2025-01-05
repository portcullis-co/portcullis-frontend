"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useOrganization } from '@clerk/nextjs';
import { Copy, CreditCard } from "lucide-react";
import { useCopyToClipboard } from 'usehooks-ts';

const SettingsPage = () => {
  const [apiKey, setApiKey] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { organization } = useOrganization();
  const [copiedText, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);
  const [portalToken, setPortalToken] = useState("");
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const fetchApiKey = async () => {
    setIsInitialLoading(true);
    if (!organization) {
      setIsInitialLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/keys?organizationId=${organization.id}`);
      const data = await response.json();
      if (data.warehouses && data.warehouses.length > 0) {
        setApiKey(data.warehouses[0].api_key);
      }
    } catch (error) {
      console.error('Failed to fetch API key:', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (organization) {
      fetchApiKey();
    }
  }, [organization]);

  useEffect(() => {
    fetchApiKey();
  }, []);

  const handleCopyApiKey = () => {
    copy(apiKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const fetchBillingPortalToken = async () => {
    setIsBillingLoading(true);
    try {
      const response = await fetch('/api/billing', { method: 'POST' });
      const result = await response.json();
      
      if (result.data && result.data.token) {
        // Redirect to Hyperline Portal
        window.location.href = `https://app.hyperline.co/portal?token=${result.data.token}`;
      } else {
        console.error('Failed to retrieve billing portal token');
      }
    } catch (error) {
      console.error('Error fetching billing portal token:', error);
    } finally {
      setIsBillingLoading(false);
    }
  };

  const [webhookUrl, setWebhookUrl] = useState("https://api.example.com/webhook");
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="api" className="flex-1 sm:flex-none">
            API Settings
          </TabsTrigger>
          {/* <TabsTrigger value="webhooks" className="flex-1 sm:flex-none">
            Webhooks
          </TabsTrigger> */}
          <TabsTrigger value="billing" className="flex-1 sm:flex-none">
            Billing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="api">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">API Configuration</h2>
                <p className="text-muted-foreground">
                  Manage your API keys and access settings
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      value={isInitialLoading ? "Loading..." : apiKey}
                      disabled={true}
                    />
                    <Button 
                      variant="secondary" 
                      onClick={handleCopyApiKey} 
                      disabled={isInitialLoading}
                    >
                      {isCopied ? "Copied!" : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="testing-mode"
                    checked={true}
                    onCheckedChange={() => {}}
                  />
                  <Label htmlFor="testing-mode">Testing Mode Enabled</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* <TabsContent value="webhooks">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Webhook Configuration</h2>
                <p className="text-muted-foreground">
                  Set up webhooks to receive real-time updates
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com/webhook"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notifications"
                      checked={notifications}
                      onCheckedChange={setNotifications}
                    />
                    <Label htmlFor="notifications">
                      Enable Event Notifications
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when webhook events are triggered
                  </p>
                </div>

                <Button className="mt-4">Save Webhook Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}

        <TabsContent value="billing">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Billing Portal</h2>
                <p className="text-muted-foreground">
                  Manage your subscription and payment details
                </p>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={fetchBillingPortalToken}
                  disabled={isBillingLoading}
                  className="w-full"
                >
                  {isBillingLoading ? (
                    "Loading..."
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Open Billing Portal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;