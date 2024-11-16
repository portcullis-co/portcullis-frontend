"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const SettingsPage = () => {
  const [apiKey, setApiKey] = useState("sk_test_123...abc");
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
          <TabsTrigger value="webhooks" className="flex-1 sm:flex-none">
            Webhooks
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
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type="password"
                    />
                    <Button variant="secondary" onClick={() => setApiKey("")}>
                      Regenerate
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

        <TabsContent value="webhooks">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;