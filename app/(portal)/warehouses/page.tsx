"use client"
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@clerk/nextjs";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { createClient as Clickhouse } from '@clickhouse/client-web';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { table } from 'console';
import Image from 'next/image';
import { PlusCircle, Plug } from 'lucide-react';
import { ExportWrapper } from '@runportcullis/portcullis-react';
import { decrypt } from '@/lib/encryption';
import { encrypt } from '@/lib/encryption';
import { Code } from '@/components/ui/code';

interface Warehouse {
  organization: string;
  id: string;
  status: string;
  tenancy_column: string;  // Name of the column used for tenant filtering
  internal_credentials: string;
  tenant_id: string;
}

interface ClickhouseCredentials {
  host: string;
  database: string;
  username: string;
  password: string;
}

interface DecryptedWarehouse extends Omit<Warehouse, 'internal_credentials'> {
  host: string;
  database: string;
}

// Add this outside the component to persist across rerenders
const DIALOG_STATE_KEY = 'warehouseIntegrationDialog';

export default function InternalWarehouseListPage() {
  const [warehouses, setWarehouses] = useState<DecryptedWarehouse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState<{ credentials: ClickhouseCredentials }>({
    credentials: {
      host: '',
      database: '',
      username: '',
      password: '',
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [tenancyColumn, setTenancyColumn] = useState<string | null>(null);
  const [isColumnSelectionStep, setIsColumnSelectionStep] = useState(false);
  const { organization, isLoaded } = useOrganization();
  const { toast } = useToast();
  const isDialogOpenRef = useRef(false);
  const [isTableSelectionStep, setIsTableSelectionStep] = useState(false); // New state for step control

  // Replace the simple dialog state with one that persists in sessionStorage
  const [openDialogId, setOpenDialogId] = useState<string | null>(() => {
    // Initialize from sessionStorage if available
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(DIALOG_STATE_KEY);
    }
    return null;
  });

  // Update the dialog state handlers
  const handleDialogOpen = (warehouseId: string) => {
    setOpenDialogId(warehouseId);
    sessionStorage.setItem(DIALOG_STATE_KEY, warehouseId);
  };

  const handleDialogClose = () => {
    setOpenDialogId(null);
    sessionStorage.removeItem(DIALOG_STATE_KEY);
  };

  useEffect(() => {
    if (isLoaded && organization) {
      fetchWarehouses(organization.id);
    } else if (isLoaded && !organization) {
      setError("No organization found. Please ensure you're part of an organization.");
      setIsLoading(false);
    }
  }, [isLoaded, organization]);

  const fetchWarehouses = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!organization) throw new Error("Organization not found");
      const response = await fetch(`/api/warehouses?organizationId=${organization.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.warehouses)) {
        throw new Error('Unexpected data format from server');
      }

      // Decrypt credentials for each warehouse
      const decryptedWarehouses = await Promise.all(
        data.warehouses.map(async (warehouse: Warehouse) => {
          try {
            // Make sure we're accessing the correct property
            if (!warehouse.internal_credentials) {
              throw new Error('No credentials found');
            }
            
            console.log('Encrypted credentials:', warehouse.internal_credentials);

            const decryptedCredsString = await decrypt(warehouse.internal_credentials);
            console.log('Decrypted string:', decryptedCredsString);

            // Add additional decryption if needed
            const finalDecryptedString = await decrypt(decryptedCredsString);
            const decryptedCreds = JSON.parse(finalDecryptedString);

            return {
              ...warehouse,
              host: decryptedCreds.host,
              database: decryptedCreds.database,
            };
          } catch (error) {
            console.error('Error decrypting credentials:', error);
            return {
              ...warehouse,
              host: 'Decryption failed',
              database: 'Decryption failed',
            };
          }
        })
      );

      setWarehouses(decryptedWarehouses);
    } catch (error) {
      console.error('Error fetching Clickhouse warehouses:', error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('/api/warehouses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to delete warehouse');
      setWarehouses(warehouses.filter(warehouse => warehouse.id !== id));
      toast({
        title: "Clickhouse Warehouse Deleted",
        description: "The Clickhouse warehouse has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting Clickhouse warehouse:', error);
      toast({
        title: "Error",
        description: "Failed to delete the Clickhouse warehouse. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchTables = async () => {
    const clickhouseClient = Clickhouse({
      url: newWarehouse.credentials.host,
      username: newWarehouse.credentials.username,
      password: newWarehouse.credentials.password,
      database: newWarehouse.credentials.database,
    });
    try {
      // Fetch tables using JSONEachRow format
      const resultSet = await clickhouseClient.query({
        query: 'SHOW TABLES',
        format: 'JSONEachRow',
      });
      const dataset: { name: string }[] = await resultSet.json();

      // Process the dataset to extract table names
      const tables = dataset.map((row) => row.name);
      setTables(tables);
      setIsTableSelectionStep(true); // Move to table selection step
    } catch (error) {
      console.error('Error fetching tables:', error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    }
  };

  const handleTestConnection = async () => {
    try {
      const clickhouseClient = Clickhouse({
        url: newWarehouse.credentials.host,
        username: newWarehouse.credentials.username,
        password: newWarehouse.credentials.password,
        database: newWarehouse.credentials.database,
      });

      // Test the connection
      await clickhouseClient.query({
        query: 'SELECT 1',
        format: 'JSONEachRow', // Specify the format
      }); // Simple query to test connection

      // If successful, proceed to fetch tables
      await fetchTables(); // Fetch tables and move to selection step
    } catch (error) {
      console.error('Error connecting Clickhouse warehouse:', error);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const fetchColumns = async () => {
    if (!selectedTable) return;
    
    const clickhouseClient = Clickhouse({
      url: newWarehouse.credentials.host,
      username: newWarehouse.credentials.username,
      password: newWarehouse.credentials.password,
      database: newWarehouse.credentials.database,
    });

    try {
      const resultSet = await clickhouseClient.query({
        query: `DESCRIBE ${selectedTable}`,
        format: 'JSONEachRow',
      });
      const dataset: { name: string }[] = await resultSet.json();
      const columnNames = dataset.map((row) => row.name);
      setColumns(columnNames);
      setIsColumnSelectionStep(true);
      setIsTableSelectionStep(false);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Error",
        description: "Failed to fetch table columns",
        variant: "destructive",
      });
    }
  };

  const handleAddWarehouse = async () => {
    if (!selectedTable || !tenancyColumn) {
      toast({
        title: "Selection Required",
        description: "Please select both a table and tenancy column before proceeding.",
        variant: "destructive",
      });
      return;
    }
  
    try {
      const orgId = organization?.id;
      if (!orgId) {
        throw new Error('Organization ID is not available');
      }
  
      // Encrypt the credentials before sending
      const credentialsString = JSON.stringify({
        host: newWarehouse.credentials.host,
        database: newWarehouse.credentials.database,
        username: newWarehouse.credentials.username,
        password: newWarehouse.credentials.password,
      });
      
      const encryptedCredentials = await encrypt(credentialsString); // You'll need to import the encrypt function

      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: orgId,
          internal_type: 'clickhouse',
          internal_credentials: encryptedCredentials,  // Send encrypted string
          table_name: selectedTable,
          tenancy_column: tenancyColumn,
          tenant_id: tenancyColumn,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add warehouse');
      }
  
      const data = await response.json();
      setWarehouses([...warehouses, data]);
      setIsDialogOpen(false);
      setNewWarehouse({
        credentials: {
          host: '',
          database: '',
          username: '',
          password: '',
        }
      });
      setSelectedTable(null);
      setIsTableSelectionStep(false);
      toast({
        title: "Clickhouse Warehouse Connected",
        description: "Your Clickhouse warehouse has been successfully connected.",
      });
    } catch (error) {
      console.error('Error connecting Clickhouse warehouse:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Internal Warehouses</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild onClick={() => handleDialogOpen('new')}>
            <Button variant="default" className="gap-2">
              <PlusCircle size={16} />
              Connect Database
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Connect Clickhouse Database</DialogTitle>
              <DialogDescription>
                Enter your Clickhouse database credentials below.
              </DialogDescription>
            </DialogHeader>
            {!isTableSelectionStep && !isColumnSelectionStep ? (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={newWarehouse.credentials.host}
                    onChange={(e) => setNewWarehouse({
                      ...newWarehouse,
                      credentials: { ...newWarehouse.credentials, host: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="database">Database</Label>
                  <Input
                    id="database"
                    value={newWarehouse.credentials.database}
                    onChange={(e) => setNewWarehouse({
                      ...newWarehouse,
                      credentials: { ...newWarehouse.credentials, database: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newWarehouse.credentials.username}
                    onChange={(e) => setNewWarehouse({
                      ...newWarehouse,
                      credentials: { ...newWarehouse.credentials, username: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newWarehouse.credentials.password}
                    onChange={(e) => setNewWarehouse({
                      ...newWarehouse,
                      credentials: { ...newWarehouse.credentials, password: e.target.value }
                    })}
                  />
                </div>
                <Button onClick={handleTestConnection}>Test Connection</Button>
              </div>
            ) : isTableSelectionStep ? (
              <div className="grid gap-4 py-4">
                <Select onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={fetchColumns}>Next</Button>
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <Select onValueChange={setTenancyColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenancy column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddWarehouse}>Connect Warehouse</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Loading your connections...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Host</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Database</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Integrate</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length > 0 ? (
                  warehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{warehouse.host}</td>
                      <td className="p-4 align-middle">{warehouse.database}</td>
                      <td className="p-4 align-middle">
                        <Dialog 
                          open={openDialogId === warehouse.id} 
                          onOpenChange={(open) => {
                            if (!open) handleDialogClose();
                            else handleDialogOpen(warehouse.id);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Plug size={16} />
                              Connect
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Integration Instructions</DialogTitle>
                              <DialogDescription>
                                Follow these steps to integrate this warehouse into your application.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-medium mb-2">1. Install the SDK</h4>
                                <Code
                                  code="npm install @runportcullis/portcullis-react"
                                  language="bash"
                                  title="Terminal"
                                />
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium mb-2">2. Add the Export Component</h4>
                                <Code 
                                  code={`import { ExportWrapper } from '@runportcullis/portcullis-react';

export default function App() {
  return (
    <ExportWrapper
      apiKey="YOUR_API_KEY" // Replace with your actual API key
      organizationId="${organization?.id}"
      internalWarehouse="${warehouse.id}"
      tableName="your-table-name" // Replace with your actual table name
      tenantId="your-tenant-id" // Replace with your actual tenant ID
    />
  );
}`}
                                  language="tsx"
                                  title="app/page.tsx"
                                  showLineNumbers
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                      <td className="p-4 align-middle">
                        <Button
                          onClick={() => handleDelete(warehouse.id)}
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                        >
                          Disconnect
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                      No Clickhouse connections found. Click "Connect Database" to add your first connection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}
      <Toaster />
    </div>
  );
}