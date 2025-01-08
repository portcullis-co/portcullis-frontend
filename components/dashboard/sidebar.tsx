"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth, useUser, useOrganization } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import {
  Home,
  Settings,
  User,
  LogOut,
  Building,
  Menu,
  X,
  Key,
  Plus,
  DatabaseZap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

interface SidebarProps {
  openWarehouseConnection: () => void;
  openAppsConnection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openWarehouseConnection, openAppsConnection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  const { user } = useUser();
  const { organization } = useOrganization();
  const auth = useAuth();

  const firstName = user?.firstName;
  const lastName = user?.lastName;
  const userInitials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`;
  const userImage = user?.imageUrl;

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("stripe_customer_id, has_active_subscription")
          .eq("id", organization.id)
          .single();

        if (error) {
          console.error("Error fetching organization data:", error);
        } else {
          setHasSubscription(data?.has_active_subscription || false);
        }

        const portalData = await supabase
          .from("portals")
          .select("id")
          .eq("organization", organization.id)
          .single();

        if (portalData.data) {
          setPortalId(portalData.data.id);
        }

        setOrganizationId(organization.id);
      } catch (error) {
        console.error("Error in fetchOrganizationData:", error);
      }

      setIsLoading(false);
    };

    fetchOrganizationData();
  }, [organization?.id]);

  const handleSubscribeClick = async () => {
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyPrice: 'price_1QeuOWGSPDCwljL797nW2ICm',
          meteredPrice: 'price_1QeuOWGSPDCwljL7YSHXy2TI',
          organizationId: organization?.id,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  const menuItems = [
    { 
      icon: Home, 
      label: "Home", 
      href: portalId ? `/portal?portalId=${portalId}` : "#",
      disabled: !portalId
    },
    { 
      icon: DatabaseZap, 
      label: "Dispatches", 
      href: portalId ? `/portal/dispatches?portalId=${portalId}` : "#",
      disabled: !portalId || !hasSubscription
    },
    { 
      icon: Settings, 
      label: "Settings", 
      href: portalId ? `/portal/settings?portalId=${portalId}` : "/settings",
      disabled: !hasSubscription
    },
    { 
      icon: Key, 
      label: "API Keys", 
      href: portalId ? `/api/keys?portalId=${portalId}` : "/api/keys",
      disabled: !hasSubscription
    },
    { 
      icon: Plus, 
      label: "Create Organization", 
      href: "/create-organization",
      disabled: !hasSubscription
    }
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <>
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to Access All Features</DialogTitle>
            <DialogDescription>
              Unlock all features by subscribing to our service.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <button
              onClick={handleSubscribeClick}
              className="w-full px-4 py-2 text-white bg-black rounded-lg hover:bg-gray-800"
            >
              Subscribe Now
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:relative md:translate-x-0
          flex flex-col
        `}
      >
        {/* Rest of the sidebar content remains the same */}
        <div className="flex items-center justify-center px-4 py-4 border-b border-gray-200">
          <Image src="/portcullis.svg" alt="Logo" width={40} height={40} />
        </div>

        <nav className="flex-grow py-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (item.disabled && !hasSubscription) {
                  e.preventDefault();
                  setShowSubscriptionDialog(true);
                }
              }}
              className={`
                flex items-center px-4 py-3 
                text-gray-700 hover:bg-gray-100 
                transition-colors duration-200
                group
                ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <item.icon
                className="mr-3 text-gray-500 group-hover:text-gray-900"
                size={20}
              />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <nav className="flex-grow py-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              className={`
                flex items-center px-4 py-3 
                text-gray-700 hover:bg-gray-100 
                transition-colors duration-200
                group
                ${(item.disabled || item.href === "#") ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <item.icon
                className="mr-3 text-gray-500 group-hover:text-gray-900"
                size={20}
              />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className="
                flex items-center justify-between 
                px-4 py-4 border-t border-gray-200 
                cursor-pointer hover:bg-gray-50
              "
            >
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userImage} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">
                    {firstName} {lastName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Building className="mr-2 h-4 w-4" />
              <span>Organization</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => auth.signOut()}
              className="text-red-600 cursor-pointer hover:bg-red-50"
            >
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