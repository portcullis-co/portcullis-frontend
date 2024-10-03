'use client';

import { useOrganization } from '@clerk/nextjs';
import React, { useState, useEffect } from 'react';

async function createInviteLink(type: string, imageUrl: string, redirectUrl: string): Promise<{ id: string; url: string; type: string; createdAt: string; imageUrl: string; redirectUrl: string }> {
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, logo: imageUrl, redirectUrl }),
  });
  if (!response.ok) throw new Error('Failed to create invite link');
  return response.json();
}

async function fetchInviteLinks() {
  const response = await fetch('/api/links');
  if (!response.ok) throw new Error('Failed to fetch invite links');
  const data = await response.json();
  console.log('Fetched links data:', data); // Add this line
  return data;
}

async function deleteInviteLink(id: string): Promise<void> {
  const response = await fetch('/api/links', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete invite link');
}
// Component definitions (assuming you don't have a UI library)
const Button = ({ onClick, disabled, children }: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
  >
    {children}
  </button>
);

const Select = ({ value, onChange, options }: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <select
    value={value}
    onChange={onChange}
    className="border border-input rounded px-2 py-1"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const Table = ({ columns, data }: {
  columns: Array<{ header: string; accessor: string; cell?: (row: any) => React.ReactNode }>;
  data: Array<Record<string, any>>;
}) => (
  <table className="w-full border-collapse">
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.accessor} className="text-left p-2 bg-muted">{column.header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.map((row, index) => (
        <tr key={index}>
          {columns.map((column) => (
            <td key={column.accessor} className="p-2 border-t border-muted">
              {column.cell ? column.cell(row) : 
                (typeof row[column.accessor] === 'object' ? JSON.stringify(row[column.accessor]) : row[column.accessor])}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

// New component for copying link
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
      <input
        type="text"
        value={link}
        readOnly
        className="border border-input rounded px-2 py-1 mr-2 flex-grow"
      />
      <button
        onClick={handleCopy}
        className="bg-secondary text-secondary-foreground px-2 py-1 rounded"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) => (
  <div className={`fixed bottom-4 right-4 p-4 rounded ${type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
    {message}
    <button onClick={onClose} className="ml-4">×</button>
  </div>
);

// Main component
export default function InviteLinks() {
  const [linkType, setLinkType] = useState('Import');
  const [links, setLinks] = useState<Array<{ id: string; url: string; type: string; createdAt: string; redirectUrl: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [redirectUrl, setRedirectUrl] = useState('');
  const imageUrl = useOrganization().organization?.imageUrl;

  const handleCreateLink = async () => {
    setIsLoading(true);
    try {
      const newLink = await createInviteLink(linkType, imageUrl || '', redirectUrl);
      setLinks((prevLinks) => [newLink, ...prevLinks]);
      setToast({ show: true, message: 'Invite link created successfully', type: 'success' });
      setRedirectUrl(''); // Clear the input after successful creation
    } catch (error) {
      console.error('Error creating invite link:', error);
      setToast({ show: true, message: 'Failed to create invite link', type: 'error' });
    }
    setIsLoading(false);
  };

  const handleDeleteLink = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteInviteLink(id);
      setLinks((prevLinks) => prevLinks.filter(link => link.id !== id));
      setToast({ show: true, message: 'Invite link deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting invite link:', error);
      setToast({ show: true, message: 'Failed to delete invite link', type: 'error' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const loadLinks = async () => {
      setIsLoading(true);
      try {
        const fetchedLinks = await fetchInviteLinks();
        console.log('Fetched links:', fetchedLinks); // Add this line
        setLinks(fetchedLinks);
      } catch (error) {
        console.error('Error fetching links:', error); // Add this line
        setToast({ show: true, message: 'Failed to load invite links', type: 'error' });
      }
      setIsLoading(false);
    };
    loadLinks();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Invite Links</h1>
      <div className="flex space-x-4 mb-4">
        <Select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value)}
          options={[
            { value: 'Import', label: 'Import' },
            { value: 'Export', label: 'Export' },
          ]}
        />
        <input
          type="text"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          placeholder="Enter redirect URL"
          className="border border-input rounded px-2 py-1"
        />
        <Button onClick={handleCreateLink} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Invite Link'}
        </Button>
      </div>
      <Table
        columns={[
          { 
            header: 'Invite Link', 
            accessor: 'invite_token', 
            cell: (row) => {
              if (!row.invite_token || !row.type) {
                return 'No link available';
              }
              const linkUrl = `${window.location.origin}/${row.type.toLowerCase()}/${row.invite_token}`;
              return <CopyLinkInput link={linkUrl} />;
            }
          },
          { 
            header: 'Type', 
            accessor: 'type',
            cell: (row) => row.type || 'N/A'
          },
          { 
            header: 'Created At', 
            accessor: 'created_at', 
            cell: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A' 
          },
          { 
            header: 'Redirect URL', 
            accessor: 'redirect_url',
            cell: (row) => row.redirect_url ? row.redirect_url : 'N/A'
          },
          { 
            header: 'Actions', 
            accessor: 'id',
            cell: (row) => (
              <Button onClick={() => handleDeleteLink(row.id)} disabled={isLoading}>
                Delete
              </Button>
            )
          },
        ]}
        data={links}
      />
      {toast.show && (
        <Toast
        message={toast.message}
        type={toast.type as "error" | "success"}
        onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}