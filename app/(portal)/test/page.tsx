'use client';

import { useOrganization } from '@clerk/nextjs';
import { ExportWrapper } from '@runportcullis/portcullis-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SDKTestPage() {
  const { organization } = useOrganization();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Portcullis SDK Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export Widget Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This is a test implementation of the Portcullis React SDK ExportWrapper component.
          </p>
          
          {organization ? (
            <ExportWrapper 
              apiKey={process.env.NEXT_PUBLIC_PORTCULLIS_API_KEY || ''}
              organizationId={organization.id}
              internalWarehouse="34b9bd83-9439-4677-9d0f-e2c6d817e1d1"
              // Optional props you can test:
              // theme="dark"
              // customStyles={{}}
              // onExportCreated={(exportData) => console.log('Export created:', exportData)}
              // onError={(error) => console.error('Export error:', error)}
            />
          ) : (
            <p className="text-yellow-600">
              Please select an organization to test the export functionality.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="prose prose-sm max-w-none">
        <h2>Implementation Details</h2>
        <pre className="bg-gray-100 p-4 rounded-lg">
          {`import { ExportWrapper } from '@runportcullis/portcullis-react';

<ExportWrapper 
  apiKey={process.env.NEXT_PUBLIC_PORTCULLIS_API_KEY}
  organizationId={organization.id}
  internalWarehouse="your-warehouse-id"
/>`}
        </pre>
        
        <h3>Required Environment Variables</h3>
        <ul>
          <li><code>NEXT_PUBLIC_PORTCULLIS_API_KEY</code> - Your Portcullis API key</li>
        </ul>

        <h3>Required Props</h3>
        <ul>
          <li><code>apiKey</code> - Your Portcullis API key</li>
          <li><code>organizationId</code> - Current organization ID</li>
          <li><code>internalWarehouse</code> - ID of the warehouse to export from</li>
        </ul>
      </div>
    </div>
  );
}