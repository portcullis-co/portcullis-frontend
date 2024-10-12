"use client"
import React, { useState, useEffect } from 'react';
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

interface Source {
  organization: string;
  id: string;
  status: string;
  type?: string;
  credentials: Credentials; // Or specify the correct type for credentials
  // Add other properties as needed
}
interface Credentials {
    [key: string]: string;
  }
  
  const credentialFields = {
    snowflake: ['account', 'user', 'password', 'warehouse', 'database', 'schema'],
    bigquery: ['project_id', 'private_key', 'client_email'],
    redshift: ['host', 'port', 'database', 'user', 'password'],
    clickhouse: ['host', 'port', 'database', 'username', 'password'], // Add Clickhouse credentials
  };
  
  export default function SourcesListPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newSource, setNewSource] = useState({ type: '', credentials: {} as Credentials });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const { organization, isLoaded } = useOrganization();
    const { toast } = useToast();
  
    useEffect(() => {
      if (isLoaded && organization) {
        console.log("Organization ID:", organization.id);
        fetchSources(organization.id);
      } else if (isLoaded && !organization) {
        console.log("No organization found");
        setError("No organization found. Please ensure you're part of an organization.");
        setIsLoading(false);
      }
    }, [isLoaded, organization]);
  
    const fetchSources = async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        if (!organization) throw new Error("Organization not found");
        const response = await fetch(`/api/sources?organizationId=${organization.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
    
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const data = await response.json();
    
        if (!data || !Array.isArray(data.sources)) {
          throw new Error('Unexpected data format from server');
        }
    
        setSources(data.sources);
      } catch (error) {
        console.error('Error fetching sources:', error);
        setError(error instanceof Error ? error.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };
  
    const handleDelete = async (id: string) => {
      try {
        const response = await fetch('/api/sources', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!response.ok) throw new Error('Failed to delete source');
        setSources(sources.filter(source => source.id !== id));
        toast({
          title: "Source Deleted",
          description: "The data source has been successfully deleted.",
        });
      } catch (error) {
        console.error('Error deleting source:', error);
        toast({
          title: "Error",
          description: "Failed to delete the data source. Please try again.",
          variant: "destructive",
        });
      }
    };
  
    const handleAddSource = async () => {
      try {
        const orgId = organization?.id;
        if (!orgId) {
          throw new Error('Organization ID is not available');
        }
    
        const response = await fetch('http://localhost:8000/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization: orgId,
            type: newSource.type,
            source_credentials: newSource.credentials,
          }),
        });
    
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add source');
        }
    
        const data = await response.json();
        setSources([...sources, data]);
        setIsDialogOpen(false);
        setNewSource({ type: '', credentials: {} });
        toast({
          title: "Source Added",
          description: "The new data source has been successfully added.",
        });
      } catch (error) {
        console.error('Error adding source:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        });
      }
    };
  
    const handleCredentialChange = (field: string, value: string) => {
      setNewSource(prev => ({
        ...prev,
        credentials: { ...prev.credentials, [field]: value }
      }));
    };
  
    const renderCredentialFields = () => {
      if (!newSource.type) return null;
      const fields = credentialFields[newSource.type as keyof typeof credentialFields];
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
  
    return (
      <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Data Sources</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mb-4">Add New Source</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Data Source</DialogTitle>
              <DialogDescription>Enter the details for your new data source.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select 
                  onValueChange={(value) => setNewSource({ type: value, credentials: {} })} 
                  value={newSource.type}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select source type" />
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
            <Button onClick={handleAddSource}>Add Source</Button>
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
            {sources.length > 0 ? (
                sources.map((source) => (
                <tr key={source.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{source.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {source.type 
                        ? source.type.charAt(0).toUpperCase() + source.type.slice(1)
                        : 'Generic'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                    <Button
                        onClick={() => handleDelete(source.id)}
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
                    No sources found. Add a new source to get started.
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