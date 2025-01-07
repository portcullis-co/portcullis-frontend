"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useOrganization, useUser } from "@clerk/nextjs";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { v4 as uuidv4 } from "uuid";

interface Transfer {
  organization: string;
  id: string;
  status: string;
  url: string;
  source: string | null;
  source_credentials: string | null;
}

export default function transferListPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [actionsDisabled, setActionsDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { organization, isLoaded } = useOrganization();
  const { user } = useUser();
  const { toast } = useToast();
  
  // Generate transferId once when component mounts
  const [transferId] = useState(() => uuidv4());

  // Generate curl command as a memoized value
  const curlCommand = React.useMemo(() => {
    if (!isLoaded || !organization || !user) return '';
    
    const { pathname } = window.location;
    const portalId = pathname.split("/")[2];
    
    return `curl -X POST https://api.yourservice.com/provision \\
  -H "Content-Type: application/json" \\
  -d '{"transferId": "${transferId}",
       "organizationId": "${organization.id}",
       "portalId": "${portalId}",
       "userId": "${user.id}"}'`;
  }, [isLoaded, organization, user, transferId]);

  useEffect(() => {
    if (isLoaded && organization) {
      fetchTransfers(organization.id);
    } else if (isLoaded && !organization) {
      setError("No organization found. Please ensure you're part of an organization.");
      setIsLoading(false);
    }
  }, [isLoaded, organization]);

  const handleDeletetransfer = async (id: string) => {
    try {
      const response = await fetch("/api/transfers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete transfer");
      }
  
      // Remove the deleted transfer from the state
      setTransfers((prevTransfers) =>
        prevTransfers.filter((transfer) => transfer.id !== id)
      );
  
      toast({
        title: "transfer Deleted",
        description: "The transfer was successfully deleted.",
        variant: "default",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete transfer.",
        variant: "destructive",
      });
    }
  };
  

  const fetchTransfers = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { pathname } = window.location;
      const portalId = pathname.split("/")[2];
      const response = await fetch(`/api/transfers?portalId=${portalId}`);
      if (!response.ok) throw new Error("Failed to fetch transfers");
      const data = await response.json();
      setTransfers(data.transfers || []);
      setActionsDisabled(data.transfers.length === 1);
    } catch (error) {
      setError("Error fetching transfers");
      toast({ title: "Error", description: "Could not fetch transfers", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddtransfer = async () => {
    try {
      const orgId = organization?.id;
      const userId = user?.id;
      const { pathname } = window.location;
      const portalId = pathname.split("/")[2];
      if (!orgId) throw new Error("Organization ID is not available");

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: orgId, portal: portalId, user: userId, transferId }),
      });

      if (!response.ok) throw new Error("Failed to deploy transfer");
      const data = await response.json();
      setTransfers([...transfers, data]);
      setIsDialogOpen(false);
      toast({
        title: "Transfer Initiated",
        description: "Your transfer was successfully deployed.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deploy transfer.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Transfer History</h1>
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <div>
              <Button
                variant="default"
                disabled={actionsDisabled}
                onClick={() => actionsDisabled ? setIsPricingOpen(true) : setIsDialogOpen(true)}
              >
                Deploy transfer
              </Button>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80" hidden={!actionsDisabled}>
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium">Need more transfers?</p>
              <p className="text-sm text-muted-foreground">
                Upgrade your plan to initiate additional transfers.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setIsPricingOpen(true)}
              >
                View Pricing
              </Button>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : transfers.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">transfer ID</TableHead>
                <TableHead className="w-1/4">URL</TableHead>
                <TableHead className="w-1/4">Status</TableHead>
                <TableHead className="w-1/4 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => {
                const canCreateEndpoint = transfer.source && transfer.source_credentials;
                return (
                  <TableRow key={transfer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{transfer.id}</TableCell>
                    <TableCell>
                      <a 
                        href={transfer.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {transfer.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transfer.status === 'running' ? 'bg-green-100 text-green-800' :
                        transfer.status === 'stopped' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transfer.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={!canCreateEndpoint}
                          onClick={() => console.log(`Create Endpoint for ${transfer.id}`)}
                        >
                          Create Endpoint
                        </Button>
                        <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletetransfer(transfer.id)}
                      >
                        Delete
                      </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground">No transfers deployed.</p>
      )}

     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Start a transfer</DialogTitle>
            <DialogDescription>
              Run the following command to start a transfer:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-100 p-4 rounded-md">
            <code className="whitespace-pre-wrap text-sm">{curlCommand}</code>
          </div>
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(curlCommand)}
            >
              Copy Command
            </Button>
            <Button variant="default" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}