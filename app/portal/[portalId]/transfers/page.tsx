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

interface Instance {
  organization: string;
  id: string;
  status: string;
  url: string;
  source: string | null;
  source_credentials: string | null;
}

export default function InstanceListPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [actionsDisabled, setActionsDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { organization, isLoaded } = useOrganization();
  const { user } = useUser();
  const { toast } = useToast();
  
  // Generate instanceId once when component mounts
  const [instanceId] = useState(() => uuidv4());

  // Generate curl command as a memoized value
  const curlCommand = React.useMemo(() => {
    if (!isLoaded || !organization || !user) return '';
    
    const { pathname } = window.location;
    const portalId = pathname.split("/")[2];
    
    return `curl -X POST https://api.yourservice.com/provision \\
  -H "Content-Type: application/json" \\
  -d '{"instanceId": "${instanceId}",
       "organizationId": "${organization.id}",
       "portalId": "${portalId}",
       "userId": "${user.id}"}'`;
  }, [isLoaded, organization, user, instanceId]);

  useEffect(() => {
    if (isLoaded && organization) {
      fetchInstances(organization.id);
    } else if (isLoaded && !organization) {
      setError("No organization found. Please ensure you're part of an organization.");
      setIsLoading(false);
    }
  }, [isLoaded, organization]);

  const handleDeleteInstance = async (id: string) => {
    try {
      const response = await fetch("/api/instances", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete instance");
      }
  
      // Remove the deleted instance from the state
      setInstances((prevInstances) =>
        prevInstances.filter((instance) => instance.id !== id)
      );
  
      toast({
        title: "Instance Deleted",
        description: "The instance was successfully deleted.",
        variant: "default",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete instance.",
        variant: "destructive",
      });
    }
  };
  

  const fetchInstances = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { pathname } = window.location;
      const portalId = pathname.split("/")[2];
      const response = await fetch(`/api/instances?portalId=${portalId}`);
      if (!response.ok) throw new Error("Failed to fetch instances");
      const data = await response.json();
      setInstances(data.instances || []);
      setActionsDisabled(data.instances.length === 1);
    } catch (error) {
      setError("Error fetching instances");
      toast({ title: "Error", description: "Could not fetch instances", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddInstance = async () => {
    try {
      const orgId = organization?.id;
      const userId = user?.id;
      const { pathname } = window.location;
      const portalId = pathname.split("/")[2];
      if (!orgId) throw new Error("Organization ID is not available");

      const response = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: orgId, portal: portalId, user: userId, instanceId }),
      });

      if (!response.ok) throw new Error("Failed to deploy instance");
      const data = await response.json();
      setInstances([...instances, data]);
      setIsDialogOpen(false);
      toast({
        title: "Instance Deployed",
        description: "Your instance was successfully deployed.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deploy instance.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Deployed Instances</h1>
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <div>
              <Button
                variant="default"
                disabled={actionsDisabled}
                onClick={() => actionsDisabled ? setIsPricingOpen(true) : setIsDialogOpen(true)}
              >
                Deploy Instance
              </Button>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80" hidden={!actionsDisabled}>
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium">Need more instances?</p>
              <p className="text-sm text-muted-foreground">
                Upgrade your plan to deploy additional instances.
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
      ) : instances.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Instance ID</TableHead>
                <TableHead className="w-1/4">URL</TableHead>
                <TableHead className="w-1/4">Status</TableHead>
                <TableHead className="w-1/4 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => {
                const canCreateEndpoint = instance.source && instance.source_credentials;
                return (
                  <TableRow key={instance.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{instance.id}</TableCell>
                    <TableCell>
                      <a 
                        href={instance.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {instance.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        instance.status === 'running' ? 'bg-green-100 text-green-800' :
                        instance.status === 'stopped' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {instance.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={!canCreateEndpoint}
                          onClick={() => console.log(`Create Endpoint for ${instance.id}`)}
                        >
                          Create Endpoint
                        </Button>
                        <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteInstance(instance.id)}
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
        <p className="text-center text-muted-foreground">No instances deployed.</p>
      )}

     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Provision New Instance</DialogTitle>
            <DialogDescription>
              Run the following command to provision your instance:
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