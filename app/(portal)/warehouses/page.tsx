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
import { Skeleton } from "@/components/ui/skeleton";
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
import { PlusCircle, Plug, Book, BookOpen } from 'lucide-react';
import { ExportComponent } from '@runportcullis/portcullis-react';
import { decrypt } from '@/lib/encryption';
import { encrypt } from '@/lib/encryption';
import { Code } from '@/components/ui/code';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';

interface Warehouse {
  organization: string;
  id: string;
  status: string;
  internal_credentials: string;
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
  
      // Add this line to set the warehouses state
      setWarehouses(data.warehouses);
  
    } catch (error) {
      console.error('Error fetching Clickhouse warehouses:', error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      toast({
        title: "Error Fetching Warehouses",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
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
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWarehouse = async () => {
    if (!selectedTable) {
      toast({
        title: "Selection Required",
        description: "Please select a table before proceeding.",
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
      
      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: orgId,
          internal_credentials: credentialsString,  // Send encrypted string
          table_name: selectedTable,
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild onClick={() => handleDialogOpen('new')}>
            <Button variant="default" color='#faff69' className="gap-2">
              <PlusCircle color='#faff69' size={16} />
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
            {!isTableSelectionStep ? (
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
                <Button onClick={handleTestConnection} disabled={isLoading}>
                  {isLoading ? <Spinner size="small" show={true} /> : "Test Connection"}
                </Button>
              </div>
            ) : (
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
                <Button onClick={handleAddWarehouse}>Connect Warehouse</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </Dialog>
      </div>
      
      {isLoading ? (
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
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b">
                    <td className="p-4 align-middle">
                      <Skeleton className="h-8 w-[200px]" />
                    </td>
                    <td className="p-4 align-middle">
                      <Skeleton className="h-8 w-[150px]" />
                    </td>
                    <td className="p-4 align-middle">
                      <Skeleton className="h-8 w-[100px]" />
                    </td>
                    <td className="p-4 align-middle">
                      <Skeleton className="h-8 w-[100px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Warehouse ID</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Integrate</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length > 0 ? (
                  warehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-left">{warehouse.id}</td>
                      <td className="p-4 align-middle">
                          <Button variant="outline" size="sm" className="gap-2">
                          <Link href="https://docs.runportcullis.co/api-reference/exports/create">
                            <BookOpen size={16} />
                            View Docs
                            </Link>
                          </Button>
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