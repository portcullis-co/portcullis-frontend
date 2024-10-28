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
  import { link } from 'fs'
  import { DataWarehouseForm } from "@/components/data-warehouse-form"; // Import the DataWarehouseForm
  import { toast, useToast } from '@/hooks/use-toast'
  import { Toaster } from './ui/toaster'
  import { DropdownMenu } from './ui/dropdown-menu'
  import { Label } from './ui/label'
  import { encrypt, decrypt } from '@/lib/encryption';
  import { runPipeline } from '@/app/actions/pipeline'

  interface Warehouse {
    id: string
    name: string
    logo: string
    connected: boolean
  }

  // Update the Credentials interface
  interface Credentials {
    username: string;
    password: string;
    host: string; // Change from 'string | null' to 'string'
    url: string; // Change from 'string | null' to 'string'
    database: string;
    port: number;
    account: string;
    application: string;
    proxyHost: string;
    schema: string;
    protocol: string;
    accessUrl: string;
    authenticator: string;
    warehouse: string;
    projectId: string;
    keyFilename: string;
    path: string;
  }
  

  interface WarehouseConnectionProps {
    token?: string;
    onClose?: () => void;  // Add this line
  }

  interface LinkDetails {
    logo: string;
    redirect_url: string;
    internal_warehouse: string;
    organization: string;
    encrypted_password: string;
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

  export default function WarehouseConnection({ token, onClose }: WarehouseConnectionProps) {
    console.log('WarehouseConnection received token:', token);
    const [isClient, setIsClient] = useState(false)
    const [step, setStep] = useState(0)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [destinations, setDestinations] = useState<Destination[]>([])
    const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
    const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const defaultCredentials: Credentials = {
      username: '',
      password: '',
      host: '',
      url: '',
      database: '',
      port: 8443,
      account: '',
      application: '',
      proxyHost: '',
      schema: '',
      protocol: '',
      accessUrl: '',
      authenticator: '',
      warehouse: '',
      projectId: '',
      keyFilename: '',
      path: '',
    }  
    const [credentials, setCredentials] = useState<Credentials>(defaultCredentials)
    const [session, setSession] = useState(() => {
      if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('warehouseConnectionSession')
        if (savedSession) {
          const parsed = JSON.parse(savedSession)
          // Ensure credentials are properly initialized from session
          return {
            ...parsed,
            credentials: { ...defaultCredentials, ...parsed.credentials }
          }
        }
      }
      return null
    })

    const containerRef = useRef<HTMLDivElement>(null)
    const linkLogoRef = useRef<HTMLDivElement>(null)
    const appLogoRef = useRef<HTMLDivElement>(null)
    const destLogoRef = useRef<HTMLDivElement>(null)

    const handlePipelineStart = async () => {
      try {
        if (!linkDetails?.internal_warehouse || !selectedWarehouse?.name) {
          throw new Error('Missing required warehouse information')
        }

        const result = await runPipeline(
          linkDetails.organization,
          linkDetails.internal_warehouse,
          selectedWarehouse.name,
          credentials
        )

        return {
          status: 200,
          data: result
        }
      } catch (error) {
        console.error('Pipeline error:', error)
        throw error
      }
    }

    const fetchLinkDetails = async (token: string): Promise<LinkDetails | null> => {
      console.log('fetchLinkDetails called with token:', token);
      const supabase = createClient(); // This will use the client-side configuration
      
      const { data, error } = await supabase
        .from('links')
        .select('logo, redirect_url, organization, internal_warehouse, encrypted_password')
        .eq('invite_token', token)
        .single();

      if (error) {
        console.error('Error fetching warehouse details:', error);
        return null;
      }

      console.log('Raw data from supabase:', data);

      if (!data) {
        console.error('No data returned from supabase');
        return null;
      }

      const details: LinkDetails = {
        internal_warehouse: data.internal_warehouse,
        organization: data.organization,
        logo: data.logo,
        redirect_url: data.redirect_url,
        encrypted_password: data.encrypted_password,
      };

      console.log('Returning link details:', details);
      return details;
    };

    useEffect(() => {
      console.log('useEffect triggered. Token:', token);
      setIsClient(true)
      setWarehouses([
        { id: '1', name: 'Clickhouse', logo: 'https://cdn.brandfetch.io/idnezyZEJm/w/400/h/400/theme/dark/icon.jpeg?k=bfHSJFAPEG', connected: false },
        { id: '2', name: 'Snowflake', logo: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?k=bfHSJFAPEG', connected: false },
        { id: '3', name: 'BigQuery', logo: 'https://cdn.worldvectorlogo.com/logos/google-bigquery-logo-1.svg', connected: false },
        { id: '4', name: 'Redshift (Coming Soon)', logo: 'https://cdn.worldvectorlogo.com/logos/aws-2.svg', connected: false },
        { id: '5', name: 'Postgres', logo: 'https://cdn.worldvectorlogo.com/logos/postgresql.svg', connected: false },
      ])
      const getLinkDetails = async () => {
        console.log('getLinkDetails called. Token:', token);
        if (token) {
          try {
            console.log('Fetching link details...');
            const details = await fetchLinkDetails(token);
            console.log('Fetched details:', details);
            if (details) {
              setLinkDetails(details);
              console.log('Link details set:', details);
            } else {
              console.error('fetchLinkDetails returned null');
              setError('Failed to fetch link details. Please try again.');
            }
          } catch (error) {
            console.error('Error in fetchLinkDetails:', error);
            setError('An error occurred while fetching link details. Please try again.');
          }
        } else {
          console.error('No token provided');
          setError('No token provided. Unable to fetch link details.');
        }
      };
      if (session) {
        setStep(session.step)
        setSelectedWarehouse(session.selectedWarehouse)
        setCredentials({ ...defaultCredentials, ...session.credentials })
        setPassword(session.password)
      }
      getLinkDetails();
    }, [token, session]);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('warehouseConnectionSession', JSON.stringify({
          step,
          selectedWarehouse,
          credentials,
          password,
        }))
      }
    }, [step, selectedWarehouse, credentials, password])

    const handleCredentialsChange = (field: keyof Credentials, value: string) => {
      setCredentials(prev => ({
        ...prev,
        [field]: value
      }))
    }
    
    const filteredWarehouses = warehouses.filter((wh) => 
      wh.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const validateHost = (url: string) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return "Host must start with http:// or https://"
      }
      return null
    }

    const verifyPassword = async (enteredPassword: string): Promise<boolean> => {
      try {
        if (!linkDetails?.encrypted_password) {
          throw new Error('Encrypted password is missing from link details');
        }
        
        const decryptedPassword = await decrypt(linkDetails.encrypted_password);
        return decryptedPassword === enteredPassword;
      } catch (error) {
        console.error('Error verifying password:', error);
        throw new Error('Failed to verify password');
      }
    };

    useEffect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('warehouseConnectionSession', JSON.stringify({
          step,
          selectedWarehouse,
          credentials,
          password,
        }));
      }
    }, [step, selectedWarehouse, credentials, password]);

    const handleBack = () => {
      if (step === 0.5) {
        setStep(0);
      } else if (step === 1) {
        setStep(0.5);
      } else if (step === 2) {
        setStep(1);
      } else if (step === 3) {
        setStep(2);
      }
    };

    const handleContinue = async () => {
      if (step === 0) {
        setStep(0.5);
        return;
      }
      if (step === 0.5) {
        try {
          if (!password) {
            setPasswordError('Password is required');
            return;
          }
          
          const isVerified = await verifyPassword(password);
          if (isVerified) {
            setStep(1);
            setPasswordError('');
          } else {
            setPasswordError('Invalid password. Please try again.');
          }
        } catch (error) {
          console.error('Password verification error:', error);
          setPasswordError('Failed to verify password. Please try again.');
        }
        return;
      } else if (step < 2) {
        setStep(step + 1);
      } else if (step === 2) {
        if (!linkDetails) {
          console.error('Link details are missing. Cannot proceed.');
          setError('Link details are missing. Please try again.');
          return;
        }
        
        console.log('Attempting to connect with credentials:', credentials);
        setIsLoading(true);
        setError(null);
        try {
          if (!selectedWarehouse || !selectedWarehouse.name) {
            throw new Error('No warehouse selected. Please select a warehouse and try again.');
          }
                // Define required fields based on warehouse type
        let requiredFields: string[] = [];
        
        switch (selectedWarehouse.name) {
          case 'Clickhouse':
            requiredFields = ['username', 'password', 'host', 'database'];
            break;
          case 'Snowflake':
            requiredFields = ['account', 'username', 'password', 'database', 'schema'];
            break;
          default:
            throw new Error('Unsupported warehouse type');
        }
    
        // Validate all required fields are present
        const missingFields = requiredFields.filter(field => !credentials[field as keyof Credentials]);
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate host format for Clickhouse
        if (selectedWarehouse.name === 'Clickhouse' && credentials.host) {
          const hostError = validateHost(credentials.host);
          if (hostError) {
            throw new Error(hostError);
          }
        }

        // Additional validation for Snowflake account
        if (selectedWarehouse.name === 'Snowflake' && credentials.account) {
          if (credentials.account.includes('.snowflakecomputing.com')) {
            throw new Error('Please enter only your account identifier without the snowflakecomputing.com domain');
            }
          }

          const result = await handlePipelineStart();
          console.log('Pipeline execution result:', result);
          
          if (result.status === 200) {
            setSuccess(true);
            setStep(3); // Move to success step
          } else {
            throw new Error(`Pipeline execution failed with status ${result.status}`);
          }
        } catch (error: unknown) {
          
          console.error('Failed to set up import:', error);
          if (error instanceof Error) {
            setError(error.message || 'Failed to set up import. Please try again.');
          } else {
            setError('An unexpected error occurred. Please try again.');
          }
          // Log the full error object
          console.error('Full error object:', JSON.stringify(error, null, 2));
        } finally {
          setIsLoading(false);
        }
      }
    };

    const clearSession = () => {
      localStorage.removeItem('warehouseConnectionSession');
      setSession(null);
    };

    const renderWarehouseFields = () => {
      if (!selectedWarehouse) return null;
    
      switch (selectedWarehouse.name) {
        case 'Clickhouse':
          return (
            <>
              <Input 
                placeholder="Host"
                value={credentials.host ?? ''}
                onChange={(e) => setCredentials({...credentials, host: e.target.value})}
              />
              <Input 
                placeholder="Username"
                value={credentials.username ?? ''}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder="Password"
                value={credentials.password ?? ''}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              />
              <Input 
                placeholder="Database Name"
                value={credentials.database ?? ''}
                onChange={(e) => setCredentials({...credentials, database: e.target.value})}
              />
            </>
          );
        case 'Snowflake':
          return (
          <>
              <Input
                placeholder="Account"
                value={credentials.account}
                onChange={(e) => handleCredentialsChange('account', e.target.value)}
              />
              <Input 
                placeholder="Database"
                value={credentials.database}
                onChange={(e) => handleCredentialsChange('database', e.target.value)}
              />
              <Input 
                placeholder="Schema"
                value={credentials.schema}
                onChange={(e) => handleCredentialsChange('schema', e.target.value)}
              />
              <Input 
                placeholder="Username"
                value={credentials.username}
                onChange={(e) => handleCredentialsChange('username', e.target.value)}
              />
              <Input 
                placeholder="Password"
                type="password"
                value={credentials.password}
                onChange={(e) => handleCredentialsChange('password', e.target.value)}
              />
            </>
          );
          case 'Postgres':
            return (
              <>
                <Input 
                  placeholder="Host"
                  value={credentials.host ?? ''}
                  onChange={(e) => handleCredentialsChange('host', e.target.value)}
                />
                <Input 
                  type="Port" 
                  placeholder="Port"
                  value={credentials.port ?? ''}
                  onChange={(e) => handleCredentialsChange('port', e.target.value)}
                />
                <Input 
                  placeholder="Database"
                  value={credentials.database ?? ''}
                  onChange={(e) => handleCredentialsChange('database', e.target.value)}
                />
                <Input 
                  placeholder="Schema"
                  value={credentials.schema ?? ''}
                  onChange={(e) => handleCredentialsChange('schema', e.target.value)}
                />
                <Input 
                  placeholder="Username"
                  value={credentials.username ?? ''}
                  onChange={(e) => handleCredentialsChange('username', e.target.value)}
                />
                <Input 
                  placeholder="Password"
                  value={credentials.password ?? ''}
                  onChange={(e) => handleCredentialsChange('password', e.target.value)}
                />
              </>
            );
            case 'MySQL':
              return (
                <>
                  <Input 
                    placeholder="Host"
                    value={credentials.host ?? ''}
                    onChange={(e) => handleCredentialsChange('host', e.target.value)}
                  />
                  <Input 
                    type="Port" 
                    placeholder="Port"
                    value={credentials.port ?? ''}
                    onChange={(e) => handleCredentialsChange('port', e.target.value)}
                  />
                  <Input 
                    placeholder="Database"
                    value={credentials.database ?? ''}
                    onChange={(e) => handleCredentialsChange('database', e.target.value)}
                  />
                  <Input 
                    placeholder="Schema"
                    value={credentials.schema ?? ''}
                    onChange={(e) => handleCredentialsChange('schema', e.target.value)}
                  />
                  <Input 
                    placeholder="Username"
                    value={credentials.username ?? ''}
                    onChange={(e) => handleCredentialsChange('username', e.target.value)}
                  />
                  <Input 
                    placeholder="Password"
                    value={credentials.password ?? ''}
                    onChange={(e) => handleCredentialsChange('password', e.target.value)}
                  />
                </>
              );
        default:
          return (
            <p>Configuration for {selectedWarehouse.name} is not available at the moment.</p>
          );
      }
    };

    const handleWarehouseSelection = (warehouse: Warehouse) => {
      setSelectedWarehouse(warehouse);
      setStep(2); // Advance to the credentials step
    };

    const renderHeader = () => (
      <div className="relative flex items-center justify-between mb-6" ref={containerRef}>
        <Circle ref={linkLogoRef}>
          {linkDetails?.logo ? (
            <Image
              src={linkDetails?.logo}  // Updated to use linkDetails.logo
              alt="Customer"
              width={40}
              height={40}
              className="w-10 h-10"
              onError={(e) => {
                console.error('Image failed to load:', linkDetails?.logo);
                e.currentTarget.src = "https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18ybXRTd1VrSnY3djVFUTJhdnlXd3NkWVlhVVoiLCJyaWQiOiJvcmdfMm11TkVlQktkVml0N01FOEJUcVUzRXRZaFZWIiwiaW5pdGlhbHMiOiJUIn0";
              }}
            />
          ) : (
            <Image 
              src="https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18ybXRTd1VrSnY3djVFUTJhdnlXd3NkWVlhVVoiLCJyaWQiOiJvcmdfMm11TkVlQktkVml0N01FOEJUcVUzRXRZaFZWIiwiaW5pdGlhbHMiOiJUIn0" 
              alt="Customer" 
              width={40}
              height={40}
              className="w-10 h-10" 
            />
          )}
        </Circle>
        <Circle ref={appLogoRef}>
          <Logo width={40} height={40} />
        </Circle>
        <Circle ref={destLogoRef}>
          {selectedWarehouse ? (
            <img src={selectedWarehouse.logo} alt={selectedWarehouse.name} className="w-10 h-10" />
          ) : (
            <Database className="w-10 h-10 text-gray-400" />
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
      const BackButton = () => (
        <Button onClick={handleBack} variant="outline" className="mr-2">
          Back
        </Button>
      );
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

          case 0.5:
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Enter Password</CardTitle>
                  <CardDescription>Please enter the password to access this invite link.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      className={passwordError ? 'border-red-500' : ''}
                    />
                    {passwordError && (
                      <p className="text-red-500 text-sm">{passwordError}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <BackButton />
                  <Button onClick={handleContinue} className="w-full ml-2">
                    Verify Password
                  </Button>
                </CardFooter>
              </Card>
            );
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
                <CardFooter>
            <BackButton />
          </CardFooter>
        </Card>
            )
            case 2:
              return (
                <div className="p-6">
                  <h3 className="text-lg font-medium mb-4">Enter your {selectedWarehouse?.name} credentials</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleContinue();
                  }} className="space-y-4">
                    {renderWarehouseFields()}
                    <div className="flex justify-between">
                      <BackButton />
                      <Button type="submit" className="w-full ml-2">
                        {isLoading ? 'Connecting...' : 'Connect'}
                      </Button>
                    </div>
                    {error && <p className="text-red-500 mt-2">{error}</p>}
                  </form>
                </div>
              );
            
            case 3:
              return (
                <Card className="max-w-lg mx-auto">
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    </div>
                    <CardTitle className="text-center">Connection Successful!</CardTitle>
                    <CardDescription className="text-center">
                      Your {selectedWarehouse?.name} warehouse has been connected and the ETL pipeline is running.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-md">
                        <p className="text-sm text-green-700">
                          Data synchronization has started. You can close this window and monitor the progress in your dashboard.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-center">
                    <Button 
                      onClick={() => {
                        clearSession();
                        onClose?.();
                      }}
                      className="w-full"
                    >
                      Close
                    </Button>
                  </CardFooter>
                </Card>
              );
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
        <Toaster />
      </Dialog>
    )
  }

