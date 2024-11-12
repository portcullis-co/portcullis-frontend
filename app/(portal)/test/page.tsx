'use client';

import { useOrganization } from '@clerk/nextjs';
import { ExportComponent } from '@runportcullis/portcullis-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from 'react';

export default function SDKTestPage() {
  const { organization, isLoaded } = useOrganization();
  const apiKey = process.env.NEXT_PUBLIC_PORTCULLIS_API_KEY;
  const [mounted, setMounted] = useState(false);
  const orgId = useOrganization().organization?.id

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
            <ExportComponent 
              apiKey={apiKey}
              organizationId={organization.id}
              internalWarehouse="7ffa2831-5dec-4de2-ad86-9735ea5e4dbf"
              tableName='dummy_data'
              tenancyColumn="org_id"
              tenancyIdentifier="org_5131c56fa5ff41df97cc1b1c890"
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