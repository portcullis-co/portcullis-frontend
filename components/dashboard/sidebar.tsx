import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { OrganizationSwitcher, useAuth, UserButton, useUser, } from '@clerk/nextjs';
import {
  Home,
  Database,
  ArrowRightLeft,
  Settings,
  CreditCard,
  ChevronUp,
  ChevronDown,
  User,
  LogOut,
  Building
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SidebarProps {
  openWarehouseConnection: () => void;
  openAppsConnection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openWarehouseConnection, openAppsConnection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const auth = useAuth()
  const firstName = user?.firstName;
  const lastName = user?.lastName;
  const userInitials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
  const userImage = user?.imageUrl;
  const signOut = auth.signOut

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
          <Image src="/portcullis.svg" alt="Portcullis Logo" width={40} height={40} />
          <span className="text-3xl font-bold tracking-tight">Portcullis</span>
        </div>
        
        <div className="h-px bg-gray-300 mx-4"></div>
        
        <nav className="flex-grow">
          <Link href="/warehouses" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
            <Database className="inline-block mr-2" size={20} />
            Internal Warehouses
          </Link>
          <Link href="/exports" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-800 hover:text-white">
            <ArrowRightLeft className="inline-block mr-2" size={20} />
            Exports
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userImage} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{firstName} {lastName}</span>
                    <span className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</span>
                  </div>
                </div>
                {isUserMenuOpen ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Building className="mr-2 h-4 w-4" />
                <span>Organization</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
    </>
  );
};

export default Sidebar;