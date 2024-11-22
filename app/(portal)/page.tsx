"use client"
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowUpRight, DollarSign, Database, Activity, TrendingUp, Users, Clock, Layers, BarChart2, ShieldCheck } from 'lucide-react';
import BoxReveal from "@/components/ui/box-reveal";
import { useOrganization, useAuth, useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link';

export default function DashboardPage() {
  const firstName = useUser().user?.firstName
  const org = useOrganization().organization?.name
  const logo = useOrganization().organization?.imageUrl

  // Sample data (you'd replace with actual data fetching)
  const dashboardStats = [
    { 
      icon: <DollarSign className="h-6 w-6 text-blue-500" />, 
      title: "", 
      value: "", 
      change: "+12.4%" 
    },
    { 
      icon: <Users className="h-6 w-6 text-green-500" />, 
      title: "Active Users", 
      value: "5,231", 
      change: "+8.2%" 
    },
    { 
      icon: <Database className="h-6 w-6 text-purple-500" />, 
      title: "Data Exports", 
      value: "1,842", 
      change: "+15.7%" 
    },
    { 
      icon: <Activity className="h-6 w-6 text-red-500" />, 
      title: "Performance", 
      value: "96.5%", 
      change: "+3.1%" 
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Welcome Section */}
        <div className="space-y-4">
            <h1 className="text-4xl font-bold">
              Welcome, <span className="text-black">{firstName}!</span>
            </h1>

            <div className="flex items-center">
              <h2 className="text-xl">
                Organization: <span className="font-semibold">{org}</span>
              </h2>
              {logo && <img src={logo} alt="Organization Logo" className="h-10 w-10 rounded-full" />}
            </div>

            <p className="text-gray-600">
              Ready to start opening the Portcullis to seamless embedded ETL in your application? We support 6+ destinations with Clickhouse, Snowflake, Redshift, BigQuery, and more..
            </p>

            <div className="flex space-x-4">
              <Button className="bg-black text-[#faff69] hover:bg-gray-800">
                <Link href={'/warehouses'}>
                Start Export Setup
                </Link>
              </Button>
              <Button variant="outline">
                View Integrations
              </Button>
            </div>
        </div>
        <div style={{ position: 'relative', paddingBottom: 'calc(49.047619047619044% + 41px)', height: '0', width: '100%' }}>
          <iframe 
            src="https://demo.arcade.software/JFPiCBoIjnITtXiuz5n7?embed&embed_mobile=inline&embed_desktop=inline&show_copy_link=true" 
            title="Portcullis | Magic Links for Enterprise Data Sharing" 
            frameBorder="0" 
            loading="lazy" 
            allowFullScreen 
            allow="clipboard-write" 
            style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', colorScheme: 'light' }}
          ></iframe>
        </div>
        {/*ARCADE EMBED END*/}
     </div>
    </div>
  );
}