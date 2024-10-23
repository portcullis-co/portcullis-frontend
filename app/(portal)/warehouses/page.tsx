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
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface Warehouse {
  organization: string;
  id: string;
  status: string;
  credentials?: ClickhouseCredentials; // Made optional to handle undefined case
}

interface ClickhouseCredentials {
  host: string;
  database: string;
  username: string;
  password: string;
}

const CLICKHOUSE_LOGO = `<img src="https://cdn.brandfetch.io/idnezyZEJm/theme/dark/symbol.svg?k=bfHSJFAPEG" alt="Clickhouse Logo" width="30" height="30" />`;

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
  const { organization, isLoaded } = useOrganization();
  const { toast } = useToast();
  const isDialogOpenRef = useRef(false);

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

  const handleAddWarehouse = async () => {
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
      toast({
        title: "Clickhouse Warehouse Connected",
        description: "Your Clickhouse warehouse has been successfully connected.",
      });
    } catch (error) {
      console.error('Error connecting Clickhouse warehouse:', error);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCredentialChange = (field: keyof ClickhouseCredentials, value: string) => {
    setNewWarehouse(prev => ({
      credentials: { ...prev.credentials, [field]: value }
    }));
  };

  const handleDialogOpen = () => {
    isDialogOpenRef.current = true;
    setIsDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mb-2" dangerouslySetInnerHTML={{ __html: CLICKHOUSE_LOGO }} />
          <h1 className="text-3xl font-bold">Clickhouse Connection Manager</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild onClick={handleDialogOpen}>
            <Button className="mb-4">Connect Clickhouse Database</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="mb-4" dangerouslySetInnerHTML={{ __html: CLICKHOUSE_LOGO }} />
              <DialogTitle>Connect to Clickhouse</DialogTitle>
              <DialogDescription>
                Enter your Clickhouse connection details below. You can find these in your Clickhouse configuration or by consulting your database administrator.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {Object.keys(newWarehouse.credentials).map((field) => (
                <div key={field} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={field} className="text-right font-medium">
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </Label>
                  <Input
                    id={field}
                    placeholder={field}
                    type={field === 'password' ? 'password' : 'text'}
                    className="col-span-3"
                    value={newWarehouse.credentials[field as keyof ClickhouseCredentials]}
                    onChange={(e) => handleCredentialChange(field as keyof ClickhouseCredentials, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleAddWarehouse} className="w-full">Connect Database</Button>
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