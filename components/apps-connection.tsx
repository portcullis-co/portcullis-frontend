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

interface Warehouse {
  id: string
  name: string
  logo: string
  connected: boolean
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

interface AppsConnectionProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function AppsConnectionComponent({ onClose }: { onClose: () => void }) {
  const [isClient, setIsClient] = useState(false)
  const [step, setStep] = useState(0)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const sourceLogoRef = useRef<HTMLDivElement>(null)
  const appLogoRef = useRef<HTMLDivElement>(null)
  const destLogoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsClient(true)
    setWarehouses([
      { id: '1', name: 'Clickhouse', logo: 'https://cdn.brandfetch.io/idnezyZEJm/w/400/h/400/theme/dark/icon.jpeg?k=bfHSJFAPEG', connected: false },
      { id: '2', name: 'Snowflake', logo: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?k=bfHSJFAPEG', connected: false },
      { id: '3', name: 'BigQuery', logo: '/placeholder.svg?height=40&width=40&text=BQ', connected: false },
      { id: '4', name: 'Redshift', logo: 'https://cdn.worldvectorlogo.com/logos/postgresql.svg', connected: false },
      { id: '5', name: 'Postgres', logo: '/placeholder.svg?height=40&width=40&text=PG', connected: false },
    ])
    setDestinations([
      { id: '1', name: 'Google Analytics', logo: 'https://cdn.brandfetch.io/idYpJMnlBx/w/192/h/192/theme/dark/logo.png?k=bfHSJFAPEG', authType: 'oauth', oauthUrl: "https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/analytics.readonly&access_type=offline&redirect_uri=http://localhost:3000&response_type=code&client_id=" + process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID },
      { id: '2', name: 'Hubspot', logo: '/placeholder.svg?height=40&width=40&text=HB', authType: 'oauth', oauthUrl: 'https://api.hubapi.com/oauth/v1/authorize', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '3', name: 'Salesforce', logo: '/placeholder.svg?height=40&width=40&text=SF', authType: 'oauth', oauthUrl: 'https://login.salesforce.com/services/oauth2/authorize', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '4', name: 'LinkedIn', logo: '/placeholder.svg?height=40&width=40&text=LI', authType: 'oauth', oauthUrl: 'https://www.linkedin.com/oauth/v2/authorization', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '5', name: 'Shopify', logo: '/placeholder.svg?height=40&width=40&text=SH', authType: 'oauth', oauthUrl: 'https://accounts.shopify.com/oauth/authorize', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '6', name: 'Braze', logo: '/placeholder.svg?height=40&width=40&text=BR', authType: 'credentials', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '7', name: 'Intercom', logo: '/placeholder.svg?height=40&width=40&text=IC', authType: 'oauth', oauthUrl: 'https://app.intercom.com/oauth', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '8', name: 'Customer.io', logo: '/placeholder.svg?height=40&width=40&text=CI', authType: 'credentials', clientId: '1234567890', clientSecret: '1234567890' },
      { id: '9', name: 'Facebook', logo: '/placeholder.svg?height=40&width=40&text=FB', authType: 'oauth', oauthUrl: 'https://www.facebook.com/dialog/oauth', clientId: '1234567890', clientSecret: '1234567890' },
    ])
  }, [])

  const filteredWarehouses = warehouses.filter(wh => 
    wh.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleContinue = () => {
    if (step < 4) {
      setStep(step + 1)
    } else {
      console.log("Final submission", { warehouse: selectedWarehouse, destination: selectedDestination })
      onClose() // Use the onClose prop instead of setIsOpen
    }
  }

  const handleOAuthAuthorization = () => {
    if (selectedDestination && selectedDestination.oauthUrl) {
      window.open(selectedDestination.oauthUrl, '_blank', 'width=600,height=600')
    }
  }

  const renderHeader = () => (
    <div className="relative flex items-center justify-between mb-6 py-4" ref={containerRef}>
      <Circle ref={sourceLogoRef}>
        <img src={selectedWarehouse?.logo || "/placeholder.svg?height=40&width=40&text=SRC"} alt="Source" className="w-10 h-10" />
      </Circle>
      <Circle ref={appLogoRef}>
      <Logo width={40} height={40} />
      </Circle>
      <Circle ref={destLogoRef}>
        <img src={selectedDestination?.logo || "/placeholder.svg?height=40&width=40&text=DST"} alt="Destination" className="w-10 h-10" />
      </Circle>
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sourceLogoRef}
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
          <div className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Connect Your Application Data</h2>
            <p className="mb-6">Sync your application data with Reverse ETL.</p>
            <Button onClick={handleContinue} className="w-full">Get Started</Button>
          </div>
        )
      case 1:
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Select your destination</h2>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <div className="grid grid-cols-3 gap-4">
                {destinations.map((destination) => (
                  <div
                    key={destination.id}
                    className="flex flex-col items-center justify-center p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => {
                      setSelectedDestination(destination)
                      handleContinue()
                    }}
                  >
                    <img src={destination.logo} alt={`${destination.name} logo`} className="w-12 h-12 rounded mb-2" />
                    <span className="text-sm text-center">{destination.name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )
        case 2:
          return (
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4">Configure Destination</h3>
              {selectedDestination?.authType === 'oauth' ? (
                <div className="space-y-4">
                  <p>Click the button below to authorize access to {selectedDestination.name}.</p>
                  <Button onClick={handleOAuthAuthorization} className="w-full">Authorize with OAuth</Button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="space-y-4">
                  <Input placeholder="API Key" />
                  <Input placeholder="Secret Key" />
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
                  <Button type="submit" className="w-full">Configure Destination</Button>
                </form>
              )}
            </div>
          )
      case 5:
        return (
          <div className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Success!</h2>
            <p className="mb-6">Your {selectedWarehouse?.name} has been connected to {selectedDestination?.name}.</p>
            <Button onClick={handleContinue} className="w-full">Finish</Button>
          </div>
        )
    }
  }

  if (!isClient) {
    return null
  }

  return (
    <>
      {renderHeader()}
      {renderStep()}
    </>
  )
}