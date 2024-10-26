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

interface Warehouse {
  organization: string;
  id: string;
  status: string;
  credentials?: ClickhouseCredentials;
}

interface ClickhouseCredentials {
  host: string;
  database: string;
  username: string;
  password: string;
}

export default function InternalWarehouseListPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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
  const { organization, isLoaded } = useOrganization();
  const { toast } = useToast();
  const isDialogOpenRef = useRef(false);
  const [isTableSelectionStep, setIsTableSelectionStep] = useState(false); // New state for step control

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

      setWarehouses(data.warehouses);
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

  const handleAddWarehouse = async () => {
    if (!selectedTable) {
      toast({
        title: "Table Selection Required",
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

      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: orgId,
          internal_type: 'clickhouse',
          credentials: newWarehouse.credentials,
          table_name: selectedTable, // Include the selected table
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add warehouse');
      }

      const data = await response.json();
      setWarehouses([...warehouses, data]);
      setIsDialogOpen(false); // Close the dialog after successful addition
      setNewWarehouse({
        credentials: {
          host: '',
          database: '',
          username: '',
          password: '',
        }
      });
      setSelectedTable(null); // Reset selected table
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

  const handleDialogOpen = () => {
    isDialogOpenRef.current = true;
    setIsDialogOpen(true);
    setIsTableSelectionStep(false); // Reset to the first step
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mb-2" />
          <Image src="/clickhouse.svg" alt="Clickhouse Logo" width={30} height={30} />
          <h1 className="text-3xl font-bold">Clickhouse Connection Manager</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild onClick={handleDialogOpen}>
            <Button className="mb-4">Connect Clickhouse Database</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="mb-4" />
              <Image src="/clickhouse.svg" alt="Clickhouse Logo" width={30} height={30} />
              <DialogTitle>{isTableSelectionStep ? "Select a Table" : "Connect to Clickhouse"}</DialogTitle>
              <DialogDescription>
                {isTableSelectionStep
                  ? "Select a table from the connected Clickhouse database."
                  : "Enter your Clickhouse connection details below."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!isTableSelectionStep ? (
                <>
                  <Label htmlFor="host" className="text-right font-medium">Host</Label>
                  <Input
                    id="host"
                    value={newWarehouse.credentials.host}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, credentials: { ...newWarehouse.credentials, host: e.target.value } })}
                  />
                  <Label htmlFor="database" className="text-right font-medium">Database</Label>
                  <Input
                    id="database"
                    value={newWarehouse.credentials.database}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, credentials: { ...newWarehouse.credentials, database: e.target.value } })}
                  />
                  <Label htmlFor="username" className="text-right font-medium">Username</Label>
                  <Input
                    id="username"
                    value={newWarehouse.credentials.username}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, credentials: { ...newWarehouse.credentials, username: e.target.value } })}
                  />
                  <Label htmlFor="password" className="text-right font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newWarehouse.credentials.password}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, credentials: { ...newWarehouse.credentials, password: e.target.value } })}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="table" className="text-right font-medium">Table</Label>
                  <Select onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-full">
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
                </>
              )}
            </div>
            {!isTableSelectionStep ? (
              <Button onClick={handleTestConnection} className="w-full">
                Test Connection
              </Button>
            ) : (
              <Button onClick={handleAddWarehouse} className="w-full">
                Connect Database
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoading ? (
        <p>Loading your connections...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Database</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {warehouses.length > 0 ? (
                warehouses.map((warehouse) => (
                  <tr key={warehouse.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{warehouse.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {warehouse.credentials?.host || 'Not available'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {warehouse.credentials?.database || 'Not available'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        onClick={() => handleDelete(warehouse.id)}
                        variant="destructive"
                        size="sm"
                      >
                        Disconnect
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No Clickhouse connections found. Click "Connect Clickhouse Database" to add your first connection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Toaster />
    </div>
  );
}