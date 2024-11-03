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
              internalWarehouse="34b9bd83-9439-4677-9d0f-e2c6d817e1d1"
              tableName='test_table'
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