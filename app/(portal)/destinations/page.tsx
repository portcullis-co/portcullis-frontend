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
import { ClickhouseCredentials, SnowflakeCredentials, BigQueryCredentials, RedshiftCredentials, AzureSynapseCredentials, CredentialsFor, TypeMappings, clickhouseToSnowflake, clickhouseToBigQuery, typeMatrix  } from '@/lib/common/types/clickhouse';
import { format } from "date-fns"
import { DateTimePicker } from "@/components/ui/datetime-picker";

enum WarehouseType {
  Clickhouse = "Clickhouse",
  Snowflake = "Snowflake",
  BigQuery = "BigQuery",
  Redshift = "Redshift",
  AzureSynapse = "AzureSynapse",
  Databricks = "Databricks",
  SQL = "SQL",
  Kafka = "Kafka",
}

const warehouseLogos: Record<WarehouseType, string> = {
  [WarehouseType.Clickhouse]: "https://cdn.brandfetch.io/idnezyZEJm/theme/dark/symbol.svg",
  [WarehouseType.Snowflake]: "https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg",
  [WarehouseType.BigQuery]: "https://cdn.icon-icons.com/icons2/2699/PNG/512/google_bigquery_logo_icon_168150.png",
  [WarehouseType.Redshift]: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROFfEqplM57B_cRPv1fdRn8tBFTrqX57n5Bg&s",
  [WarehouseType.AzureSynapse]: "https://azure.microsoft.com/svghandler/synapse-analytics/?width=600&height=315",
  [WarehouseType.Databricks]: "https://cdn.brandfetch.io/idSUrLOWbH/theme/dark/symbol.svg?k=bfHSJFAPEG",
  [WarehouseType.SQL]: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwuqWn7rCVhqZ_pSlxwVUzlZtFWaOMdbm28A&s",
  [WarehouseType.Kafka]: "https://upload.wikimedia.org/wikipedia/commons/0/05/Apache_kafka.svg",
};

type Destination = {
  id: string;
  createdAt: string;
  source_warehouse: string;
  destination_type: WarehouseType;
  destination_name: string;
  credentials: string;
  scheduled_at?: Date;
};

async function createDestination(
  organizationId: string,
  source_warehouse: string,
  destination_type: WarehouseType,
  destination_name: string,
  credentials: string,
  scheduled_at?: Date
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
      scheduled_at
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
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short'
  }).format(date);
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

const CredentialForm = ({ type, onChange, scheduledAt, setScheduledAt }: { 
  type: WarehouseType, 
  onChange: (creds: Record<string, any>) => void,
  scheduledAt?: Date,
  setScheduledAt: (date: Date | undefined) => void
}) => {
  const [localCredentials, setLocalCredentials] = useState<Record<string, any>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const newValue = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
    const updatedCredentials = { ...localCredentials, [field]: newValue };
    setLocalCredentials(updatedCredentials);
    onChange(updatedCredentials);
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  switch (type) {
    case WarehouseType.Clickhouse:
      return (
        <div className="space-y-4">
          <Input
            placeholder="Host"
            onChange={(e) => handleInputChange(e, 'host')}
            value={localCredentials.host || ''}
          />
          <Input
            placeholder="Port"
            type="number"
            onChange={(e) => handleInputChange(e, 'port')}
            value={localCredentials.port || ''}
          />
          <Input
            placeholder="Database"
            onChange={(e) => handleInputChange(e, 'database')}
            value={localCredentials.database || ''}
          />
          <Input
            placeholder="Username"
            onChange={(e) => handleInputChange(e, 'username')}
            value={localCredentials.username || ''}
          />
          <Input
            type="password"
            placeholder="Password"
            onChange={(e) => handleInputChange(e, 'password')}
            value={localCredentials.password || ''}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.Snowflake:
      return (
        <div className="space-y-4">
          <Input
            placeholder="Account"
            onChange={(e) => handleInputChange(e, 'account')}
            value={localCredentials.account || ''}
          />
          <Input
            placeholder="Username"
            onChange={(e) => handleInputChange(e, 'username')}
            value={localCredentials.username || ''}
          />
          <Input
            type="password"
            placeholder="Password"
            onChange={(e) => handleInputChange(e, 'password')}
            value={localCredentials.password || ''}
          />
          <Input
            placeholder="Warehouse"
            onChange={(e) => handleInputChange(e, 'warehouse')}
            value={localCredentials.warehouse || ''}
          />
          <Input
            placeholder="Database"
            onChange={(e) => handleInputChange(e, 'database')}
            value={localCredentials.database || ''}
          />
          <Input
            placeholder="Schema"
            onChange={(e) => handleInputChange(e, 'schema')}
            value={localCredentials.schema || ''}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.BigQuery:
      return (
        <div className="space-y-4">
          <Input placeholder="Project ID" onChange={(e) => handleInputChange(e, 'projectId')} value={localCredentials.projectId || ''} />
          <Input placeholder="Dataset" onChange={(e) => handleInputChange(e, 'dataset')} value={localCredentials.dataset || ''} />
          <Input placeholder="Table" onChange={(e) => handleInputChange(e, 'table')} value={localCredentials.table || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.Redshift:
      return (
        <div className="space-y-4">
          <Input placeholder="Host" onChange={(e) => handleInputChange(e, 'host')} value={localCredentials.host || ''} />
          <Input placeholder="Port" type="number" onChange={(e) => handleInputChange(e, 'port')} value={localCredentials.port || ''} />
          <Input placeholder="Database" onChange={(e) => handleInputChange(e, 'database')} value={localCredentials.database || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      )
    case WarehouseType.Databricks:
      return (
        <div className="space-y-4">
          <Input placeholder="Host" onChange={(e) => handleInputChange(e, 'host')} value={localCredentials.host || ''} />
          <Input type="token" placeholder="Token" onChange={(e) => handleInputChange(e, 'token')} value={localCredentials.token || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.SQL:
      return (
        <div className="space-y-4">
          <Input placeholder="Host" onChange={(e) => handleInputChange(e, 'host')} value={localCredentials.host || ''} />
          <Input placeholder="Port" type="number" onChange={(e) => handleInputChange(e, 'port')} value={localCredentials.port || ''} />
          <Input placeholder="Database" onChange={(e) => handleInputChange(e, 'database')} value={localCredentials.database || ''} />
          <Input placeholder="Username" onChange={(e) => handleInputChange(e, 'username')} value={localCredentials.username || ''} />
          <Input type="password" placeholder="Password" onChange={(e) => handleInputChange(e, 'password')} value={localCredentials.password || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.Kafka:
      return (
        <div className="space-y-4">
          <Input placeholder="Host" onChange={(e) => handleInputChange(e, 'host')} value={localCredentials.host || ''} />
          <Input placeholder="Port" type="number" onChange={(e) => handleInputChange(e, 'port')} value={localCredentials.port || ''} />
          <Input placeholder="Topic" onChange={(e) => handleInputChange(e, 'topic')} value={localCredentials.topic || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    case WarehouseType.AzureSynapse:
      return (
        <div className="space-y-4">
          <Input placeholder="Host" onChange={(e) => handleInputChange(e, 'host')} value={localCredentials.host || ''} />
          <Input placeholder="Port" type="number" onChange={(e) => handleInputChange(e, 'port')} value={localCredentials.port || ''} />
          <Input placeholder="Database" onChange={(e) => handleInputChange(e, 'database')} value={localCredentials.database || ''} />
          <Input placeholder="Username" onChange={(e) => handleInputChange(e, 'username')} value={localCredentials.username || ''} />
          <Input type="password" placeholder="Password" onChange={(e) => handleInputChange(e, 'password')} value={localCredentials.password || ''} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Export (Optional)</label>
            <DateTimePicker
              value={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              displayFormat={{
                hour24: "yyyy-MM-dd HH:mm:ss zzz",
                hour12: "yyyy-MM-dd hh:mm:ss a zzz"
              }}
              hourCycle={24}
              granularity="second"
              placeholder={`Select date and time (${userTimeZone})`}
              locale="en-US"
              weekStartsOn={0}
              showWeekNumber={false}
              showOutsideDays={true}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
};

const CreateDestinationDialog = ({ 
  isOpen, 
  onClose, 
  warehouses, 
  onCreateDestination 
}: { 
  isOpen: boolean;
  onClose: () => void;
  warehouses: Array<{ id: string; created_at: string }>;
  onCreateDestination: (data: {
    warehouseId: string;
    destinationType: WarehouseType;
    name: string;
    credentials: Record<string, any>;
    scheduledAt?: Date;
  }) => void;
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [destinationType, setDestinationType] = useState<WarehouseType>(WarehouseType.Snowflake);
  const [destinationName, setDestinationName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

  const handleSubmit = () => {
    onCreateDestination({
      warehouseId: selectedWarehouseId,
      destinationType,
      name: destinationName,
      credentials,
      scheduledAt
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            value={destinationName}
            onChange={(e) => setDestinationName(e.target.value)}
            placeholder="Enter destination name"
            required
          />

          <CredentialForm 
            type={destinationType} 
            onChange={setCredentials} 
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
          />

          <Button 
            onClick={handleSubmit}
            disabled={!selectedWarehouseId || !destinationName}
          >
            Create Destination
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function Destinations() {
  const { organization } = useOrganization();
  const organizationId = organization?.id || '';
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const imageUrl = useOrganization().organization?.imageUrl;
  const { toast } = useToast()
  const [recipientEmail, setRecipientEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleCreateDestination = async (data: {
    warehouseId: string;
    destinationType: WarehouseType;
    name: string;
    credentials: Record<string, any>;
    scheduledAt?: Date;
  }) => {
    setIsLoading(true);
    try {
      const newDestination = await createDestination(
        organizationId,
        data.warehouseId,
        data.destinationType,
        data.name,
        JSON.stringify(data.credentials),
        data.scheduledAt
      );

      if (newDestination && newDestination.id) {
        setDestinations((prev) => [newDestination, ...prev]);
        showToast('Destination created successfully', 'success');
        setIsDialogOpen(false);
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Export Destinations</h1>
      <Button onClick={() => setIsDialogOpen(true)}>Create Destination</Button>
      
      <CreateDestinationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        warehouses={warehouses}
        onCreateDestination={handleCreateDestination}
      />

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