"use client";
// app/dispatches/page.tsx
import React, { useEffect, useState } from "react";
import DispatchTable from "@/components/dashboard/dispatch-table"; // Adjust path as needed
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";

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

const DispatchesPage = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const portalId = searchParams.get("portalId"); // Get portalId from query params
  
  useEffect(() => {
    if (!portalId) {
      setError("Missing portalId in query parameters.");
      setIsLoading(false);
      return;
    }

    const fetchDispatches = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("dispatches")
          .select("*")
          .eq("portal", portalId)
          .order("created_at", { ascending: false });

        console.log("All dispatches:", data);
    
        console.log("Supabase data:", data);
        console.log("Supabase error:", error);
    
        if (error) throw error;
    
        setDispatches(data || []);
      } catch (err) {
        console.error("Error fetching dispatches:", err);
        setError("Failed to load dispatches");
      } finally {
        setIsLoading(false);
      }
    };    

    fetchDispatches();
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dispatches</h1>
      <DispatchTable dispatches={dispatches} />
    </div>
  );
};

export default DispatchesPage;