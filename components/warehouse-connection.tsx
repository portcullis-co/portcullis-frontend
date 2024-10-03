"use client"

import React, { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, CheckCircle, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AnimatedBeam } from "@/components/ui/animated-beam"
import Logo from "@/public/portcullis.svg"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from '@/lib/supabase/client'
import { Database } from 'lucide-react'  // or your preferred icon library
import Image from 'next/image';

interface Warehouse {
  id: string
  name: string
  logo: string
  connected: boolean
}

interface LinkDetails {
  type: string;
  import_id: string;
  logo: string;
  redirect_url: string;
}

interface Destination {
  id: string
  name: string
  logo: string
  authType: 'oauth' | 'credentials'
  oauthUrl?: string
  clientId?: string
  clientSecret?: string
}

const Circle = React.forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => {
  return (
    <div
      ref={ref}
      className={`z-10 flex size-16 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)] ${className}`}
    >
      {children}
    </div>
  );
});

Circle.displayName = "Circle";

export default function WarehouseConnectionComponent({ token }: { token: string }) {
  const [isClient, setIsClient] = useState(false)
  const [step, setStep] = useState(0)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    host: '',
    database: '',
    warehouse: '', // For Snowflake
    projectId: '', // For BigQuery
    keyFilename: '', // For BigQuery
    path: '', // For Databricks
    // Add any other necessary fields
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const linkLogoRef = useRef<HTMLDivElement>(null)
  const appLogoRef = useRef<HTMLDivElement>(null)
  const destLogoRef = useRef<HTMLDivElement>(null)

  const fetchLinkDetails = async (token: string): Promise<LinkDetails | null> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('links')
      .select('type, import_id, logo, redirect_url')
      .eq('invite_token', token)
      .single();
  
    if (error) {
      console.error('Error fetching source details:', error);
      return null;
    }
  
    return {
      type: data.type,
      import_id: data.import_id,
      logo: data.logo,
      redirect_url: data.redirect_url,
    };
  };

  useEffect(() => {
    setIsClient(true)
    setWarehouses([
      { id: '1', name: 'Clickhouse', logo: 'https://cdn.brandfetch.io/idnezyZEJm/w/400/h/400/theme/dark/icon.jpeg?k=bfHSJFAPEG', connected: false },
      { id: '2', name: 'Snowflake', logo: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?k=bfHSJFAPEG', connected: false },
      { id: '3', name: 'BigQuery', logo: '/placeholder.svg?height=40&width=40&text=BQ', connected: false },
      { id: '4', name: 'Databricks', logo: '/placeholder.svg?height=40&width=40&text=DB', connected: false },
      { id: '5', name: 'Postgres', logo: '/placeholder.svg?height=40&width=40&text=PG', connected: false },
    ])
    const getLinkDetails = async () => {
      const details = await fetchLinkDetails(token);
      if (details) {
        setLinkDetails(details);
      }
    }
    getLinkDetails();
  }, [token])  // Add token as a dependency
  

  const filteredWarehouses = warehouses.filter(wh => 
    wh.name.toLowerCase().includes(searchTerm.toLowerCase())
  )



  const handleContinue = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Prepare the warehouse configuration based on the selected warehouse type
      let warehouseConfig: any = {
        type: selectedWarehouse?.name.toLowerCase(),
      };
      
      switch(selectedWarehouse?.name.toLowerCase()) {
        case 'clickhouse':
          warehouseConfig = {
            ...warehouseConfig,
            url: credentials.host, // Use 'url' instead of 'host'
            database: credentials.database,
            username: credentials.username,
            password: credentials.password
          };
          break;
        case 'snowflake':
          warehouseConfig = {
            ...warehouseConfig,
            account: credentials.host,
            username: credentials.username,
            password: credentials.password,
            database: credentials.database,
            warehouse: credentials.warehouse
          };
          break;
        case 'bigquery':
          warehouseConfig = {
            ...warehouseConfig,
            projectId: credentials.projectId,
            keyFilename: credentials.keyFilename
          };
          break;
        case 'databricks':
          warehouseConfig = {
            ...warehouseConfig,
            host: credentials.host,
            token: credentials.password,
            path: credentials.path
          };
          break;
        case 'postgres':
          warehouseConfig = {
            ...warehouseConfig,
            host: credentials.host,
            port: 5432,
            database: credentials.database,
            user: credentials.username,
            password: credentials.password
          };
          break;
        default:
          console.error('Unsupported warehouse type');
          return;
      }
  
      // Submit credentials to the API
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceCredentials: warehouseConfig,
          importCredentials: {
            type: 'destination',
            // Add any necessary destination credentials here
          },
          etlJob: {
            query: "SELECT * FROM your_table", // Replace with actual query
            destination: "your_destination_table", // Replace with actual destination
          },
        }),
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('Import setup result:', result);
        setStep(4); // Move to success step
      } else {
        const errorData = await response.json();
        console.error('Failed to set up import:', errorData);
        // Handle error (e.g., show error message to user)
      }
    }
  };

  const handleOAuthAuthorization = () => {
    if (selectedDestination && selectedDestination.oauthUrl) {
      window.open(selectedDestination.oauthUrl, '_blank', 'width=600,height=600')
    }
  }

  const handleWarehouseSelection = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setStep(2); // Advance to the credentials step
  };

  const renderHeader = () => (
    <div className="relative flex items-center justify-between mb-6" ref={containerRef}>
      <Circle ref={destLogoRef}>
        {selectedWarehouse ? (
          <img src={selectedWarehouse.logo} alt={selectedWarehouse.name} className="w-10 h-10" />
        ) : (
          <Database className="w-10 h-10 text-gray-400" />
        )}
      </Circle>
      <Circle ref={appLogoRef}>
        <Logo width={40} height={40} />
      </Circle>
      <Circle ref={linkLogoRef}>
      {linkDetails?.logo ? (
        <Image
          src={linkDetails?.logo ?? "/placeholder.svg?height=40&width=40&text=CUST"}
          alt="Customer"
          width={40}
          height={40}
          className="w-10 h-10"
          onError={(e) => {
            console.error('Image failed to load:', linkDetails?.logo);
            e.currentTarget.src = "/placeholder.svg?height=40&width=40&text=CUST";
          }}
        />
      ) : (
        <Image 
          src="/placeholder.svg?height=40&width=40&text=CUST" 
          alt="Customer" 
          width={40}
          height={40}
          className="w-10 h-10" 
        />
      )}
      </Circle>
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={linkLogoRef}
        toRef={appLogoRef}
        duration={1.5}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={appLogoRef}
        toRef={destLogoRef}
        duration={1.5}
      />
    </div>
  )

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle>Connect Your Data Warehouse</CardTitle>
              <CardDescription>Securely connect and share data from your warehouse.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Secure Connection Process:</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>End-to-end encryption for data protection</li>
                  <li>Read-only access by default</li>
                  <li>Encrypted credentials, never stored in plain text</li>
                </ul>
                
                <div className="bg-blue-50 p-3 rounded-md mt-2">
                  <p className="text-xs text-blue-600">
                    You maintain full control over your data. Access can be modified or revoked at any time.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleContinue} className="w-full">Get Started</Button>
            </CardFooter>
          </Card>
        )
        case 1:
          return (
            <Card>
              <CardHeader>
                <CardTitle>Select your data warehouse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search warehouses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <ul className="space-y-2">
                  {filteredWarehouses.map((warehouse) => (
                    <li 
                      key={warehouse.id} 
                      className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                      onClick={() => handleWarehouseSelection(warehouse)}
                    >
                      <div className="flex items-center space-x-3">
                        <img src={warehouse.logo} alt={`${warehouse.name} logo`} className="w-8 h-8 rounded" />
                        <span>{warehouse.name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        case 2:
          return (
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4">Enter your credentials</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="space-y-4">
                <Input 
                  placeholder="Username or Account Name" 
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                />
                <Input 
                  type="password" 
                  placeholder="Password or Access Token"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                />
                <Input 
                  placeholder="Host or Region"
                  value={credentials.host}
                  onChange={(e) => setCredentials({...credentials, host: e.target.value})}
                />
                <Input 
                  placeholder="Database Name"
                  value={credentials.database}
                  onChange={(e) => setCredentials({...credentials, database: e.target.value})}
                />
                <Button type="submit" className="w-full">Connect</Button>
              </form>
            </div>
          )
  
        case 3:
          return (
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4">Configure ETL Job</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="space-y-4">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ETL frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="w-full">Set Up ETL Job</Button>
              </form>
            </div>
          )
  
          case 4:
            return (
              <div className="p-6 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-4">Success!</h2>
                <p className="mb-6">Your {selectedWarehouse?.name} has been connected and the ETL job has been set up.</p>
                <Button onClick={() => {
                  if (linkDetails?.redirect_url) {
                    window.location.href = linkDetails.redirect_url;
                  } else {
                    setStep(0);
                  }
                }} className="w-full">
                  Finish
                </Button>
              </div>
          )
      }
    }

  if (!isClient) {
    return null
  }

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect Warehouse</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderHeader()}
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  )
}