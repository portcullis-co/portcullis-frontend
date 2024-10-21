'use client';

import { useOrganization } from '@clerk/nextjs';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@clerk/nextjs"
import internal from 'stream';

type Link = {
  id: string;
  url: string;
  createdAt: string;
  imageUrl: string;
  redirectUrl: string;
  invite_token: string;
  internal_warehouse: string;
  internal_type: string;
};
async function createInviteLink(imageUrl: string, redirectUrl: string, internal_warehouse: string, internal_type: string): Promise<Link> {
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logo: imageUrl, redirectUrl, internal_warehouse, internal_type }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create invite link');
  }
  return response.json();
}

async function fetchInviteLinks() {
  const response = await fetch('/api/links');
  if (!response.ok) throw new Error('Failed to fetch invite links');
  return response.json();
}

const capitalizeFirstLetter = (string: string) => {
  if (!string) return ''; // Add this line to handle undefined or empty strings
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

async function deleteInviteLink(id: string): Promise<void> {
  const response = await fetch('/api/links', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete invite link');
}

async function fetchWarehouses(organizationId: string) {
  const response = await fetch(`/api/warehouses?organizationId=${organizationId}`);
  if (!response.ok) throw new Error('Failed to fetch warehouses');
  return response.json();
}

export default function InviteLinks() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [links, setLinks] = useState<Link[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; internal_type: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const imageUrl = useOrganization().organization?.imageUrl;
  const { toast } = useToast() // Add this line

  useEffect(() => {
    loadLinks();
    if (organizationId) {
      loadWarehouses();
    }
  }, [organizationId]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const fetchedLinks = await fetchInviteLinks();
      console.log('Fetched links:', fetchedLinks); // Log the fetched links
      setLinks(fetchedLinks.filter((link: any) => link !== null)); // Filter out any null links
    } catch (error) {
      console.error('Error fetching links:', error);
      showToast('Failed to load invite links', 'error');
    }
    setIsLoading(false);
  };
  
  const loadWarehouses = async () => {
    if (!organizationId) {
      console.error('No organization ID available');
      showToast('Failed to load warehouses: No organization ID', 'error');
      return;
    }
    try {
      const response = await fetchWarehouses(organizationId);
      console.log('Fetched warehouse data:', response); // Log the entire response

      if (response && Array.isArray(response.warehouses)) {
        setWarehouses(response.warehouses);
      } else {
        console.error('Invalid warehouses data format:', response);
        showToast('Invalid warehouses data format', 'error');
        setWarehouses([]);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      showToast('Failed to load warehouses', 'error');
      setWarehouses([]);
    }
  };

  const handleCreateLink = async () => {
    setIsLoading(true);
    try {
      console.log('Selected Warehouse ID:', selectedWarehouseId);
      const selectedWarehouse = warehouses.find(warehouse => warehouse.id === selectedWarehouseId);
      const type = selectedWarehouse ? selectedWarehouse.internal_type : ''; 
      const newLink = await createInviteLink(imageUrl || '', redirectUrl, selectedWarehouseId, type);
      
      if (newLink && newLink.invite_token) {
        const copyableLink = `${window.location.origin}/invite/${newLink.invite_token}`;
        setLinks((prevLinks) => [newLink, ...prevLinks]);
        showToast('Invite link created successfully', 'success');
        setRedirectUrl('');
        setSelectedWarehouseId('');
        setIsDialogOpen(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error creating invite link:', error);
      showToast('Failed to create invite link', 'error');
    }
    setIsLoading(false);
  };

  const handleDeleteLink = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteInviteLink(id);
      setLinks((prevLinks) => prevLinks.filter(link => link.id !== id));
      showToast('Invite link deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting invite link:', error);
      showToast('Failed to delete invite link', 'error');
    }
    setIsLoading(false);
  };

  const showToast = (message: string, type: 'error' | 'success') => {
    toast({
      title: type === 'success' ? 'Success' : 'Error',
      description: message,
      variant: type === 'success' ? 'default' : 'destructive',
    })
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Invite Links</h1>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>Create New Invite Link</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Invite Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.length > 0 ? (
                  warehouses.map((warehouse: { id: string; internal_type: string; created_at: string }) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {`${capitalizeFirstLetter(warehouse.internal_type)} - ${formatDate(warehouse.created_at)}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-warehouses" disabled>No warehouses available</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="Enter redirect URL"
            />
            <Button onClick={handleCreateLink} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Invite Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invite Link</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        {links.map((row) => row && (
          <TableRow key={row.id}>
            <TableCell>
              <CopyLinkInput link={`${window.location.origin}/invite/${row.invite_token}`} /> {/* Use invite_token for the link */}
            </TableCell>
            <TableCell>{row.internal_type}</TableCell>
            <TableCell>
              <Button 
                onClick={() => handleDeleteLink(row.id)} 
                variant="destructive"
                disabled={isLoading}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
        <Toaster />
    </div>
  );
}

const CopyLinkInput = ({ link }: { link: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center">
      <Input value={link} readOnly className="mr-2" />
      <Button onClick={handleCopy} variant="secondary">
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
};