import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from 'next/image';

const warehouseOptions = [
  { value: 'clickhouse', label: 'Clickhouse', logo: '/path/to/clickhouse-logo.png' },
  { value: 'snowflake', label: 'Snowflake', logo: '/path/to/snowflake-logo.png' },
  { value: 'bigquery', label: 'BigQuery', logo: '/path/to/bigquery-logo.png' },
  { value: 'Redshift (Coming Soon)', label: 'Redshift (Coming Soon)', logo: 'https://cdn.worldvectorlogo.com/logos/postgresql.svg' },
  { value: 'postgres', label: 'Postgres', logo: '/path/to/postgres-logo.png' },
];

export function DataWarehouseForm({ onConnect }: { onConnect: (warehouseType: string, credentials: Record<string, unknown>) => void }) {
  const [warehouseType, setWarehouseType] = useState('');
  const [credentials, setCredentials] = useState<Record<string, unknown>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConnect(warehouseType, credentials);
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const renderCredentialFields = () => {
    switch (warehouseType) {
      case 'clickhouse':
        return (
          <>
            <Input
              placeholder="Host"
              onChange={(e) => handleCredentialChange('host', e.target.value)}
            />
            <Input
              placeholder="Port"
              onChange={(e) => handleCredentialChange('port', e.target.value)}
            />
            <Input
              placeholder="Username"
              onChange={(e) => handleCredentialChange('username', e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              onChange={(e) => handleCredentialChange('password', e.target.value)}
            />
          </>
        );
      case 'snowflake':
        return (
          <>
            <Input
              placeholder="Account"
              onChange={(e) => handleCredentialChange('account', e.target.value)}
            />
            <Input
              placeholder="User"
              onChange={(e) => handleCredentialChange('user', e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              onChange={(e) => handleCredentialChange('password', e.target.value)}
            />
            <Input
              placeholder="Warehouse"
              onChange={(e) => handleCredentialChange('warehouse', e.target.value)}
            />
          </>
        );
      case 'bigquery':
        return (
          <>
            <Input
              placeholder="Project ID"
              onChange={(e) => handleCredentialChange('project_id', e.target.value)}
            />
            <textarea
              className="w-full p-2 border rounded"
              placeholder="Private Key JSON"
              onChange={(e) => handleCredentialChange('private_key', e.target.value)}
            />
          </>
        );
      case 'databricks':
        return (
          <>
            <Input
              placeholder="Host"
              onChange={(e) => handleCredentialChange('host', e.target.value)}
            />
            <Input
              placeholder="HTTP Path"
              onChange={(e) => handleCredentialChange('http_path', e.target.value)}
            />
            <Input
              type="password"
              placeholder="Access Token"
              onChange={(e) => handleCredentialChange('token', e.target.value)}
            />
          </>
        );
      case 'postgres':
        return (
          <>
            <Input
              placeholder="Host"
              onChange={(e) => handleCredentialChange('host', e.target.value)}
            />
            <Input
              placeholder="Port"
              onChange={(e) => handleCredentialChange('port', e.target.value)}
            />
            <Input
              placeholder="Database"
              onChange={(e) => handleCredentialChange('database', e.target.value)}
            />
            <Input
              placeholder="User"
              onChange={(e) => handleCredentialChange('User', e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              onChange={(e) => handleCredentialChange('password', e.target.value)}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {warehouseOptions.map((option) => (
          <Card 
            key={option.value} 
            className={`cursor-pointer ${warehouseType === option.value ? 'border-primary' : ''}`}
            onClick={() => setWarehouseType(option.value)}
          >
            <CardContent className="flex flex-col items-center justify-center h-24 p-2">
              <Image src={option.logo} alt={option.label} width={40} height={40} />
              <span className="mt-2 text-sm">{option.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {warehouseType && (
        <div className="space-y-2">
          {renderCredentialFields()}
        </div>
      )}

      <Button type="submit" disabled={!warehouseType}>Connect</Button>
    </form>
  );
}