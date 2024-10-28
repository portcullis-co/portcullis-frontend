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
import crypto from 'crypto';

type Link = {
  id: string;
  url: string;
  createdAt: string;  // This should match the field name from the API
  imageUrl: string;
  redirectUrl: string;
  invite_token: string;
  internal_warehouse: string;
  recipient_email?: string;
};


async function createInviteLink(
  organizationId: string,
  imageUrl: string, 
  redirectUrl: string, 
  internal_warehouse: string,
  recipient_email: string,
  password: string,
): Promise<Link> {
  
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization: organizationId,
      logo: imageUrl, 
      redirectUrl, 
      internal_warehouse,
      recipient_email,
      password: password,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Server error:', errorData);
    throw new Error(errorData.error || 'Failed to create invite link');
  }
  const data = await response.json();
  console.log('Server response:', data);
  return data;
}

async function fetchInviteLinks() {
  const response = await fetch('/api/links');
  if (!response.ok) throw new Error('Failed to fetch invite links');
  return response.json();
}

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
  const organizationId = organization?.id || '';
  const [links, setLinks] = useState<Link[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const imageUrl = useOrganization().organization?.imageUrl;
  const { toast } = useToast()
  const [recipientEmail, setRecipientEmail] = useState(''); // Add this line
  const [password, setPassword] = useState('');

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
      setLinks(fetchedLinks.filter((link: any) => link !== null));
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
      if (!organization || !organization.id) {
        throw new Error('No organization ID available');
      }
  
      const newLink = await createInviteLink(
        organizationId,
        imageUrl || '',
        redirectUrl,
        selectedWarehouseId,
        recipientEmail,
        password
      );
  
      if (newLink && newLink.invite_token) {
        const copyableLink = `${window.location.origin}/invite/${newLink.invite_token}`;
        setLinks((prevLinks) => [newLink, ...prevLinks]);
        showToast('Invite link created successfully', 'success');
        setRedirectUrl('');
        setSelectedWarehouseId('');
        setRecipientEmail('');
        setIsDialogOpen(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error creating invite link:', error);
      showToast('Failed to create invite link', 'error');
    } finally {
      setIsLoading(false);
    }
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
                <SelectValue placeholder="Select a warehouse">
                  {selectedWarehouseId ? (
                    <div className="flex items-center gap-2">
                      <img 
                        src="https://cdn.brandfetch.io/idnezyZEJm/theme/dark/symbol.svg?k=bfHSJFAPEG"
                        alt="Clickhouse Logo" 
                        className="w-4 h-4"
                      />
                      <span>{selectedWarehouseId}</span>
                    </div>
                  ) : (
                    "Select a warehouse"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehouses.length > 0 ? (
                  warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      <div className="flex items-center gap-2">
                        <img 
                          src="https://cdn.brandfetch.io/idnezyZEJm/theme/dark/symbol.svg?k=bfHSJFAPEG"
                          alt="Clickhouse Logo" 
                          className="w-4 h-4"
                        />
                        <span>{warehouse.id}</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-warehouses" disabled>No warehouses available</SelectItem>
                )}
              </SelectContent>
            </Select>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter recipient's email"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password for the invite link"
                required
              />
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="Enter redirect URL"
              />
              <Button 
                onClick={handleCreateLink} 
                disabled={isLoading || !recipientEmail || !selectedWarehouseId || !password}
              >
                {isLoading ? 'Creating...' : 'Create Invite Link'}
              </Button>
            </div>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invite Link</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((row) => row && (
            <TableRow key={row.id}>
              <TableCell>
                <CopyLinkInput link={`${window.location.origin}/invite/${row.invite_token}`} />
              </TableCell>
              <TableCell>{row.recipient_email}</TableCell>
              <TableCell>{formatDate(row.createdAt)}</TableCell>
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