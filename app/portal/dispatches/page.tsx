"use client";
// app/dispatches/page.tsx
import React, { useEffect, useState } from "react";
import DispatchTable from "@/components/dashboard/dispatch-table";
import CurlCommandDialog from "@/components/command-dialog";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid"; // Import the UUID library

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Dispatch {
  id: string;
  status: string;
  progress: number;
  source: string;
  created_at: string;
  portalId: string;
  lambda_url: string;
}

interface Portal {
  api_key: string;
}

const DispatchesPage = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [portalDetails, setPortalDetails] = useState<Portal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const portalId = searchParams.get("portalId");

  useEffect(() => {
    if (!portalId) {
      setError("Missing portalId in query parameters.");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch dispatches
        const { data: dispatchesData, error: dispatchesError } = await supabase
          .from("dispatches")
          .select("*")
          .eq("portal", portalId)
          .order("created_at", { ascending: false });

        if (dispatchesError) throw dispatchesError;

        // Fetch portal details
        const { data: portalData, error: portalError } = await supabase
          .from("portals")
          .select("api_key")
          .eq("id", portalId)
          .single();

        if (portalError) throw portalError;

        setDispatches(dispatchesData || []);
        setPortalDetails(portalData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [portalId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <h3 className="font-medium">Error</h3>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  // Generate a new dispatch ID
  const dispatchId = uuidv4();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dispatches</h1>
        {portalDetails && (
          <CurlCommandDialog 
            portalId={portalId!}
            apiKey={portalDetails.api_key}
            dispatchId={dispatchId} // Use the generated UUID here
          />
        )}
      </div>
      <DispatchTable dispatches={dispatches} />
    </div>
  );
};

export default DispatchesPage;