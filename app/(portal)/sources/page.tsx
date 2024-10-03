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

interface Source {
  id: string;
  type: string;
  status: string;
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
  
  export default function SourcesListPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newSource, setNewSource] = useState({ type: '', credentials: {} as Credentials });
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();
    const organizationId = useOrganization().organization?.id;
  
    useEffect(() => {
        console.log("Organization ID:", organizationId);
        if (organizationId) {
          fetchSources(organizationId);
        }
      }, [organizationId]);
    
      const fetchSources = async (organizationId: string) => {
        try {
          const response = await fetch(`/api/sources?organizationId=${organizationId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
      
          if (!response.ok) {
            throw new Error('Failed to fetch sources');
          }
          const data = await response.json();
          setSources(data.sources);
        } catch (error) {
          console.error('Error fetching sources:', error);
          setError("Failed to fetch sources");
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
      } catch (error) {
        console.error('Error deleting source:', error);
        // Handle error (e.g., show error message to user)
      }
    };
  
    const handleAddSource = async () => {
        try {
          const response = await fetch('/api/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSource),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add source');
          }
          const addedSource = await response.json();
          setSources([...sources, addedSource.data]);
          setIsDialogOpen(false);
          setNewSource({ type: '', credentials: {} });
        } catch (error) {
          console.error('Error adding source:', error);
          // Handle error (e.g., show error message to user)
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {sources.length > 0 ? (
                sources.map((source) => (
                <tr key={source.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{source.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{source.status}</td>
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
      </div>
    );
}