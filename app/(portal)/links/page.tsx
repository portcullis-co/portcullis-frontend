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

type Link = {
  id: string;
  url: string;
  type: string;
  createdAt: string;
  imageUrl: string;
  redirectUrl: string;
  sourceId: string;
};

async function createInviteLink(type: string, imageUrl: string, redirectUrl: string, sourceId: string): Promise<{ id: string; url: string; type: string; createdAt: string; imageUrl: string; redirectUrl: string; sourceId: string }> {
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, logo: imageUrl, redirectUrl, source: sourceId }),
  });
  if (!response.ok) throw new Error('Failed to create invite link');
  return response.json();
}

async function fetchInviteLinks() {
  const response = await fetch('/api/links');
  if (!response.ok) throw new Error('Failed to fetch invite links');
  return response.json();
}

const capitalizeFirstLetter = (string: string) => {
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

async function fetchSources(organizationId: string) {
  const response = await fetch(`/api/sources?organizationId=${organizationId}`);
  if (!response.ok) throw new Error('Failed to fetch sources');
  return response.json();
}

export default function InviteLinks() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [linkType, setLinkType] = useState('Import');
  const [links, setLinks] = useState<Link[]>([]);
  const [sources, setSources] = useState<Array<{ id: string; type: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const imageUrl = useOrganization().organization?.imageUrl;
  const { toast } = useToast() // Add this line

  useEffect(() => {
    loadLinks();
    if (organizationId) {
      loadSources();
    }
  }, [organizationId]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const fetchedLinks = await fetchInviteLinks();
      setLinks(fetchedLinks);
    } catch (error) {
      console.error('Error fetching links:', error);
      showToast('Failed to load invite links', 'error');
    }
    setIsLoading(false);
  };
  const loadSources = async () => {
    if (!organizationId) {
      console.error('No organization ID available');
      showToast('Failed to load sources: No organization ID', 'error');
      return;
    }
    try {
      const sourcesData = await fetchSources(organizationId);
      console.log('Fetched sources data:', sourcesData); // Add this line for debugging
      if (Array.isArray(sourcesData)) {
        setSources(sourcesData);
      } else if (typeof sourcesData === 'object' && sourcesData !== null) {
        // If the data is an object, try to extract an array from it
        const sourcesArray = Object.values(sourcesData).flat();
        console.log('Extracted sources array:', sourcesArray); // Add this line for debugging
        console.log('Extracted sources array:', sourcesArray);
        if (Array.isArray(sourcesArray) && sourcesArray.length > 0 && 
            typeof sourcesArray[0] === 'object' && sourcesArray[0] !== null &&
            'id' in sourcesArray[0] && 'type' in sourcesArray[0] && 'created_at' in sourcesArray[0]) {
          setSources(sourcesArray as Array<{ id: string; type: string; created_at: string }>);
        } else {
          console.error('Extracted data is not a valid array of sources:', sourcesArray);
          showToast('Invalid sources data format', 'error');
          setSources([]);
        }
      } else {
        console.error('Fetched sources data is not an array or object:', sourcesData);
        showToast('Invalid sources data format', 'error');
        setSources([]);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
      showToast('Failed to load sources', 'error');
      setSources([]);
    }
  };

  const handleCreateLink = async () => {
    setIsLoading(true);
    try {
      const newLink = await createInviteLink(linkType, imageUrl || '', redirectUrl, selectedSourceId);
      setLinks((prevLinks) => [newLink, ...prevLinks]);
      showToast('Invite link created successfully', 'success');
      setRedirectUrl('');
      setSelectedSourceId('');
      setIsDialogOpen(false);
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
          <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a source" />
            </SelectTrigger>
            <SelectContent>
              {sources.length > 0 ? (
                sources.map((source: { id: string; type: string; created_at: string }) => (
                  <SelectItem key={source.id} value={source.id}>
                    {`${capitalizeFirstLetter(source.type)} - ${formatDate(source.created_at)}`}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-sources" disabled>No sources available</SelectItem>
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
          {links.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <CopyLinkInput link={`${window.location.origin}/${row.type.toLowerCase()}/${row.id}`} />
              </TableCell>
              <TableCell>{row.type}</TableCell>
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