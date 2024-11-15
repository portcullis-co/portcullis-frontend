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
import { ClickhouseCredentials, SnowflakeCredentials, BigQueryCredentials, TypeMatrix  } from '@/lib/common/types/clickhouse.d';

enum WarehouseType {
  Clickhouse = "Clickhouse",
  Snowflake = "Snowflake",
  BigQuery = "BigQuery",
  Redshift = "Redshift",
  AzureSynapse = "AzureSynapse",
  IBMDb2 = "IBMDb2",
  Oracle = "Oracle",
  Teradata = "Teradata",
  SAPDWC = "SAPDWC",
  Firebolt = "Firebolt"
}

const warehouseLogos: Record<WarehouseType, string> = {
  [WarehouseType.Clickhouse]: "https://cdn.brandfetch.io/idnezyZEJm/theme/dark/symbol.svg",
  [WarehouseType.Snowflake]: "https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg",
  [WarehouseType.BigQuery]: "https://cdn.icon-icons.com/icons2/2699/PNG/512/google_bigquery_logo_icon_168150.png",
  [WarehouseType.Redshift]: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROFfEqplM57B_cRPv1fdRn8tBFTrqX57n5Bg&s",
  [WarehouseType.AzureSynapse]: "https://cdn.brandfetch.io/idCWvWKkh6/theme/dark/symbol.svg",
  [WarehouseType.IBMDb2]: "/ibm-db2-logo.svg",
  [WarehouseType.Oracle]: "/oracle-logo.svg",
  [WarehouseType.Teradata]: "/teradata-logo.svg",
  [WarehouseType.SAPDWC]: "/sap-logo.svg",
  [WarehouseType.Firebolt]: "/firebolt-logo.svg"
};

type Destination = {
  id: string;
  createdAt: string;
  source_warehouse: string;
  destination_type: WarehouseType;
  destination_name: string;
  credentials: string;
};

async function createDestination(
  organizationId: string,
  source_warehouse: string,
  destination_type: WarehouseType,
  destination_name: string,
  credentials: string,
): Promise<Destination> {
  const response = await fetch('/api/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization: organizationId,
      source_warehouse,
      destination_type,
      destination_name,
      credentials,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Server error:', errorData);
    throw new Error(errorData.error || 'Failed to create destination');
  }
  const data = await response.json();
  console.log('Server response:', data);
  return data;
}

async function fetchDestinations(organizationId: string) {
  const response = await fetch(`/api/destinations?organizationId=${organizationId}`);
  if (!response.ok) throw new Error('Failed to fetch destinations');
  return response.json();
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

async function deleteDestination(id: string): Promise<void> {
  const response = await fetch('/api/destinations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete destination');
}

async function fetchWarehouses(organizationId: string) {
  const response = await fetch(`/api/warehouses?organizationId=${organizationId}`);
  if (!response.ok) throw new Error('Failed to fetch warehouses');
  return response.json();
}

export default function Destinations() {
  const { organization } = useOrganization();
  const organizationId = organization?.id || '';
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const imageUrl = useOrganization().organization?.imageUrl;
  const { toast } = useToast()
  const [recipientEmail, setRecipientEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination_name, setDestinationName] = useState('');
  const [warehouseType, setWarehouseType] = useState<WarehouseType>(WarehouseType.Clickhouse);
const [credentials, setCredentials] = useState<any>({}); // Will store the credentials based on type
const [destinationType, setDestinationType] = useState<WarehouseType>(WarehouseType.Snowflake);

  useEffect(() => {
    loadDestinations();
    if (organizationId) {
      loadWarehouses();
    }
  }, [organizationId]);

  const loadDestinations = async () => {
    setIsLoading(true);
    try {
      const fetchedDestinations = await fetchDestinations(organizationId);
      setDestinations(fetchedDestinations.filter((destination: any) => destination !== null));
    } catch (error) {
      console.error('Error fetching destinations:', error);
      showToast('Failed to load destinations', 'error');
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

  const handleCreateDestination = async () => {
    setIsLoading(true);
    try {
      if (!organization?.id) {
        throw new Error('No organization ID available');
      }

      const newDestination = await createDestination(
        organizationId,
        selectedWarehouseId,
        destinationType,
        destination_name,
        JSON.stringify(credentials),
      );

      if (newDestination && newDestination.id) {
        setDestinations((prevDestinations) => [newDestination, ...prevDestinations]);
        showToast('Destination created successfully', 'success');
        setSelectedWarehouseId('');
        setCredentials({});
        setIsDialogOpen(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error creating destination:', error);
      showToast('Failed to create destination', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteDestination(id);
      setDestinations((prevDestinations) => prevDestinations.filter(destination => destination.id !== id));
      showToast('Destination deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting destination:', error);
      showToast('Failed to delete destination', 'error');
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

  const CredentialForm = ({ type, onChange }: { 
    type: WarehouseType, 
    onChange: (creds: any) => void 
  }) => {
    switch (type) {
      case WarehouseType.Clickhouse:
        return (
          <>
            <Input
              placeholder="Host"
              onChange={(e) => onChange({ ...credentials, host: e.target.value })}
            />
            <Input
              placeholder="Port"
              type="number"
              onChange={(e) => onChange({ ...credentials, port: parseInt(e.target.value) })}
            />
            <Input
              placeholder="Database"
              onChange={(e) => onChange({ ...credentials, database: e.target.value })}
            />
            <Input
              placeholder="Username"
              onChange={(e) => onChange({ ...credentials, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Password"
              onChange={(e) => onChange({ ...credentials, password: e.target.value })}
            />
          </>
        );
      case WarehouseType.Snowflake:
        return (
          <>
            <Input
              placeholder="Account"
              onChange={(e) => onChange({ ...credentials, account: e.target.value })}
            />
            <Input
              placeholder="Username"
              onChange={(e) => onChange({ ...credentials, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Password"
              onChange={(e) => onChange({ ...credentials, password: e.target.value })}
            />
            <Input
              placeholder="Warehouse"
              onChange={(e) => onChange({ ...credentials, warehouse: e.target.value })}
            />
            <Input
              placeholder="Database"
              onChange={(e) => onChange({ ...credentials, database: e.target.value })}
            />
            <Input
              placeholder="Schema"
              onChange={(e) => onChange({ ...credentials, schema: e.target.value })}
            />
          </>
        );
      // Add more cases for other warehouse types
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Export Destinations</h1>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>Create Destination</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Export Destination</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source warehouse">
                  {selectedWarehouseId && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={warehouseLogos[WarehouseType.Clickhouse]}
                        alt="Clickhouse Logo" 
                        className="w-4 h-4"
                      />
                      <span>{selectedWarehouseId}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    <div className="flex items-center gap-2">
                      <img 
                        src={warehouseLogos[WarehouseType.Clickhouse]}
                        alt="Clickhouse Logo" 
                        className="w-4 h-4"
                      />
                      <span>{warehouse.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={destinationType} onValueChange={(value: WarehouseType) => setDestinationType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination type">
                  {destinationType && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={warehouseLogos[destinationType]}
                        alt={`${destinationType} Logo`} 
                        className="w-4 h-4"
                      />
                      <span>{destinationType}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(WarehouseType).map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <img 
                        src={warehouseLogos[type]}
                        alt={`${type} Logo`} 
                        className="w-4 h-4"
                      />
                      <span>{type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={destination_name}
              onChange={(e) => setDestinationName(e.target.value)}
              placeholder="Enter destination name"
              required
            />

            <CredentialForm type={destinationType} onChange={setCredentials} />

            <Button 
              onClick={handleCreateDestination} 
              disabled={isLoading || !selectedWarehouseId || !destination_name}
            >
              {isLoading ? 'Creating...' : 'Create Destination'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {destinations.map((row) => row && (
            <TableRow key={row.id}>
              <TableCell>{row.destination_name}</TableCell>
              <TableCell>{row.source_warehouse}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <img 
                    src={warehouseLogos[row.destination_type as WarehouseType]}
                    alt={`${row.destination_type} Logo`} 
                    className="w-4 h-4"
                  />
                  <span>{row.destination_type}</span>
                </div>
              </TableCell>
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