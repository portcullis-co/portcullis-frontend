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
  DatabaseZap,
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

const Sidebar: React.FC = () => {
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
    const fetchSubscriptionData = async () => {
      if (!organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("organization", organization.id)
          .single();

        if (subscriptionError) {
          console.error("Error fetching subscription data:", subscriptionError);
        } else {
          setHasSubscription(subscriptionData?.status === "active");
        }

        const { data: portalData, error: portalError } = await supabase
          .from("portals")
          .select("id")
          .eq("organization", organization.id)
          .maybeSingle();

        if (portalError) {
          console.error("Error fetching portal data:", portalError);
        } else if (portalData) {
          setPortalId(portalData.id);
        }

        setOrganizationId(organization.id);
      } catch (error) {
        console.error("Error in fetchSubscriptionData:", error);
      }

      setIsLoading(false);
    };

    fetchSubscriptionData();
  }, [organization?.id]);

  const handleSubscribeClick = async () => {
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meteredPrice: "price_1QfGitGSPDCwljL7WaxYfMF8",
          organizationId: organization?.id,
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        console.error("URL not returned from server");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    }
  };

  const menuItems = [
    { 
      icon: Home, 
      label: "Home", 
      href: `/portal?portalId=${portalId}`,
      requiresSubscription: false
    },
    {
      icon: DatabaseZap,
      label: "Dispatches",
      href: `/portal/dispatches?portalId=${portalId}`,
      requiresSubscription: true
    },
    {
      icon: Settings,
      label: "Settings",
      href: portalId ? `/portal/settings?portalId=${portalId}` : "/settings",
      requiresSubscription: true
    },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isItemDisabled = (requiresSubscription: boolean) => {
    if (!requiresSubscription) return false;
    if (!portalId) return true;
    return !hasSubscription;
  };

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
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:relative md:translate-x-0
          flex flex-col h-screen
        `}
      >
        <div className="flex items-center justify-center h-14 px-4 border-b border-gray-200">
          <Image src="/dispatch.png" className="rounded-full" alt="Logo" width={35} height={35} />
        </div>

        <nav className="flex-1 py-2">
          {menuItems.map((item) => {
            const disabled = isItemDisabled(item.requiresSubscription);
            return (
              <Link
                key={item.href}
                href={disabled ? "#" : item.href}
                onClick={(e) => {
                  if (disabled) {
                    e.preventDefault();
                    setShowSubscriptionDialog(true);
                  }
                }}
                className={`
                  flex items-center px-4 py-2 
                  text-gray-700 hover:bg-gray-100 
                  transition-colors duration-200
                  group
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <item.icon
                  className="mr-3 text-gray-500 group-hover:text-gray-900"
                  size={18}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className="
                flex items-center px-3 py-2 border-t border-gray-200 
                cursor-pointer hover:bg-gray-50 h-14
              "
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={userImage} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {firstName} {lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
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