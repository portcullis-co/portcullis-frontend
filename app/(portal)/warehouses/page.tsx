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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@clerk/nextjs";
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface Warehouse {
  organization: string;
  id: string;
  status: string;
  internal_type?: string;
  credentials: Credentials; // Or specify the correct type for credentials
  // Add other properties as needed
}
interface Credentials {
    [key: string]: string;
  }
  
  const credentialFields = {
    snowflake: ['account', 'username', 'password', 'warehouse', 'database', 'schema'],
    bigquery: ['project_id', 'private_key', 'client_email'],
    redshift: ['host', 'port', 'database', 'user', 'password'],
    clickhouse: ['host', 'port', 'database', 'username', 'password'], // Add Clickhouse credentials
  };
  
  export default function InternalWarehouseListPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newWarehouse, setNewWarehouse] = useState({ internal_type: '', credentials: {} as Credentials });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const { organization, isLoaded } = useOrganization();
    const { toast } = useToast();
  
    useEffect(() => {
      if (isLoaded && organization) {
        console.log("Organization ID:", organization.id);
        fetchWarehouses(organization.id);
      } else if (isLoaded && !organization) {
        console.log("No organization found");
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
        console.error('Error fetching internal warehouses:', error);
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
        setWarehouses(warehouses.filter(warehouses => warehouses.id !== id));
        toast({
          title: "Internal warehouse Deleted",
          description: "The internal warehouse has been successfully deleted.",
        });
      } catch (error) {
        console.error('Error deleting internal warehouse:', error);
        toast({
          title: "Error",
          description: "Failed to delete the internal warehouse. Please try again.",
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
            internal_type: newWarehouse.internal_type,
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
        setNewWarehouse({ internal_type: '', credentials: {} });
        toast({
          title: "Warehouse Added",
          description: "The new internal warehouse has been successfully added.",
        });
      } catch (error) {
        console.error('Error adding internal warehouse:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        });
      }
    };
  
    const handleCredentialChange = (field: string, value: string) => {
      setNewWarehouse(prev => ({
        ...prev,
        credentials: { ...prev.credentials, [field]: value }
      }));
    };
  
    const renderCredentialFields = () => {
      if (!newWarehouse.internal_type) return null;
      const fields = credentialFields[newWarehouse.internal_type as keyof typeof credentialFields];
      return fields.map(field => (
        <div key={field} className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor={field} className="text-right">{field}</Label>
          <Input
            id={field}
            type={field.includes('password') ? 'password' : 'text'}
            className="col-span-3"
            onChange={(e) => handleCredentialChange(field, e.target.value)}
          />
        </div>
      ));
    };

    const isDialogOpenRef = useRef(false); // Added ref to track dialog state

    useEffect(() => {
      if (isDialogOpenRef.current) {
        setIsDialogOpen(true); // Keep dialog open if it was open
      }
    }, [isDialogOpenRef.current]);
    
    const handleDialogOpen = () => {
      isDialogOpenRef.current = true; // Update ref when dialog opens
      setIsDialogOpen(true);
    };
    
    const handleDialogClose = () => {
      isDialogOpenRef.current = false; // Update ref when dialog closes
      setIsDialogOpen(false);
    };
  
    return (
      <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Data Warehouses</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild onClick={handleDialogOpen}>
            <Button className="mb-4">Add New Internal Warehouse</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Data Warehouse</DialogTitle>
              <DialogDescription>Enter the details for your new internal warehouse.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select 
                  onValueChange={(value) => setNewWarehouse({ internal_type: value, credentials: {} })} 
                  value={newWarehouse.internal_type}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select warehouse type" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="snowflake">Snowflake</SelectItem>
                  <SelectItem value="bigquery">BigQuery</SelectItem>
                  <SelectItem value="redshift">Redshift</SelectItem>
                  <SelectItem value="clickhouse">Clickhouse</SelectItem> {/* Add Clickhouse option */}
                </SelectContent>
                </Select>
              </div>
              {renderCredentialFields()}
            </div>
            <Button onClick={handleAddWarehouse}>Add Warehouse</Button>
          </DialogContent>
          </Dialog>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {warehouses.length > 0 ? (
                warehouses.map((warehouse) => (
                <tr key={warehouse.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{warehouse.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {warehouse.internal_type 
                        ? warehouse.internal_type.charAt(0).toUpperCase() + warehouse.internal_type.slice(1)
                        : 'Generic'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                    <Button
                        onClick={() => handleDelete(warehouse.id)}
                        variant="destructive"
                    >
                        Delete
                    </Button>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                <td colSpan={3} className="px-6 py-4 text-center">
                    No warehous found. Add a new warehouse to get started.
                </td>
                </tr>
            )}
            </tbody>
          </table>
        </div>
        </>
      )}
      <Toaster />
    </div>
  );
}