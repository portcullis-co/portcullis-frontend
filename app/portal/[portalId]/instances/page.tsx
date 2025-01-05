"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  useEffect(() => {
    if (isLoaded && organization) {
      fetchInstances(organization.id);
    } else if (isLoaded && !organization) {
      setError("No organization found. Please ensure you're part of an organization.");
      setIsLoading(false);
    }
  }, [isLoaded, organization]);

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
        body: JSON.stringify({ organization: orgId, portal: portalId, user: userId }),
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
                          onClick={() => console.log(`Delete ${instance.id}`)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deployment</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to deploy a new instance?</p>
          <div className="flex space-x-4 mt-4">
            <Button variant="default" onClick={handleAddInstance}>
              Yes
            </Button>
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}