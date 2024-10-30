"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import { Home, Database, ArrowRightLeft, Settings, PlusCircle, CreditCard } from 'lucide-react'
import Logo from "@/public/portcullis.svg"
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation';
import { OrganizationSwitcher } from '@clerk/nextjs'

interface SidebarProps {
  openWarehouseConnection: () => void;
  openAppsConnection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openWarehouseConnection, openAppsConnection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-20 p-2 bg-gray-800 text-white rounded-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Close' : 'Menu'}
      </button>
      <div className={`bg-grey border text-black w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out flex flex-col z-10`}>
      <div className="flex items-center justify-start px-4 space-x-3">
        <Logo className="w-10 h-10" />
        <span className="text-3xl font-bold tracking-tight">Portcullis</span>
      </div>
      
      <div className="h-px bg-gray-300 mx-4"></div>
      
      <nav className="flex-grow">
        <Link href="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Home className="inline-block mr-2" size={20} />
          Dashboard
        </Link>
        <Link href="/warehouses" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Database className="inline-block mr-2" size={20} />
          Internal Warehouses
        </Link>
<<<<<<< HEAD
        <Link href="/exports" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <ArrowRightLeft className="inline-block mr-2" size={20} />
          Exports
=======
        <Link href="/destinations" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <ArrowRightLeft className="inline-block mr-2" size={20} />
          Destinations
>>>>>>> 6a429ee (no more links)
        </Link>
        <Link href="/settings" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Settings className="inline-block mr-2" size={20} />
          Settings
        </Link>
        <Link href="/billing" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <CreditCard className="inline-block mr-2" size={20} />
          Billing
        </Link>
      </nav>
      <div className="px-4 mt-auto">
        <OrganizationSwitcher 
          appearance={{
            elements: {
              rootBox: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
              },
              organizationSwitcherTrigger: {
                padding: '6px',
                width: '100%',
                borderRadius: '4px',
                border: '1px solid #4B5563',
                backgroundColor: '#1F2937',
                color: 'white',
              },
            },
          }}
        />
      </div>
    </div>
    </>
  )
}

export default Sidebar