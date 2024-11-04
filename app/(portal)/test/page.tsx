'use client';

import { useOrganization } from '@clerk/nextjs';
import { ExportWrapper } from '@runportcullis/portcullis-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from 'react';

export default function SDKTestPage() {
  const { organization, isLoaded } = useOrganization();
  const apiKey = process.env.NEXT_PUBLIC_PORTCULLIS_API_KEY;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('Organization:', organization?.id);
    console.log('API Key present:', !!apiKey);
  }, [organization, apiKey]);

  if (!mounted || !isLoaded) {
    return <div>Loading...</div>;
  }

  if (!apiKey) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-red-600">
          Missing NEXT_PUBLIC_PORTCULLIS_API_KEY environment variable
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Portcullis SDK Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export Widget Test</CardTitle>
        </CardHeader>
        <CardContent>
          {organization ? (
            <ExportWrapper 
              apiKey={apiKey}
              organizationId={organization.id}
              internalWarehouse="0aff5b5d-a4e2-419d-99e1-be1019728cbc"
              tableName='dummy_data'
              tenancyId="org_5131c56fa5ff41df97cc1b1c890"
              tenancyColumn="org_id"
            />
          ) : (
            <p className="text-yellow-600">
              Please select an organization to test the export functionality.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}