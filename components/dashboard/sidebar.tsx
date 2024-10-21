"use client"
import React from 'react'
import Link from 'next/link'
import { Home, Database, ArrowRightLeft, Settings, PlusCircle } from 'lucide-react'
import Logo from "@/public/portcullis.svg"
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation';
import { OrganizationSwitcher } from '@clerk/nextjs'

interface SidebarProps {
  openWarehouseConnection: () => void;
  openAppsConnection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openWarehouseConnection, openAppsConnection }) => {
  const router = useRouter();
  return (
    <div className="bg-grey border text-black w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition duration-200 ease-in-out flex flex-col">
      <div className="flex items-center space-x-2 px-4">
        <Logo width={32} height={32} />
        <span className="text-2xl font-extrabold">Portcullis</span>
      </div>
      <nav className="flex-grow">
        <Link href="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Home className="inline-block mr-2" size={20} />
          Dashboard
        </Link>
        <Link href="/warehouses" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Database className="inline-block mr-2" size={20} />
          Internal Warehouses
        </Link>
        <Link href="/links" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <ArrowRightLeft className="inline-block mr-2" size={20} />
          Connect Links
        </Link>
        <Link href="/settings" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
          <Settings className="inline-block mr-2" size={20} />
          Settings
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
  )
}

export default Sidebar