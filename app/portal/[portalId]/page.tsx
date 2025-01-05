"use client"
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Bell, Database, ShieldCheck, TrendingUp } from 'lucide-react';
import { useOrganization, useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function DashboardPage() {
  const firstName = useUser().user?.firstName
  const org = useOrganization().organization?.name
  const logo = useOrganization().organization?.imageUrl

  const features = [
    {
      icon: <Database className="w-6 h-6 text-blue-500" />,
      title: "Multi-Warehouse Support",
      description: "Connect and sync data across Clickhouse, Snowflake, BigQuery, and more."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-green-500" />,
      title: "Enterprise-Grade Security",
      description: "End-to-end encryption and robust access controls to protect your data."
    },
    {
      icon: <Bell className="w-6 h-6 text-purple-500" />,
      title: "Sync Update Notifications",
      description: "Updates on sync status and coverage via email and SMS."
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6 max-h-screen overflow-hidden">
      <div className="grid grid-cols-1 pb-4 lg:grid-cols-2 gap-6 h-full">
        {/* Welcome Section */}
        <div className="flex flex-col justify-between space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome, <span className="text-black">{firstName}!</span>
              </h1>

              <div className="flex items-center space-x-2 mb-4">
                <h2 className="text-lg">
                  Organization: <span className="font-semibold">{org}</span>
                </h2>
                {logo && <img src={logo} alt="Organization Logo" className="h-8 w-8 rounded-full" />}
              </div>

              <p className="text-gray-600 mb-4">
                Ready to start opening the Portcullis to seamless embedded ETL in your application? We support 6+ destinations with Clickhouse, Snowflake, Redshift, BigQuery, and more..
              </p>
            </div>

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
        
        <div className="h-full max-h-[500px]">
          <iframe 
            src="https://demo.arcade.software/JFPiCBoIjnITtXiuz5n7?embed&embed_mobile=inline&embed_desktop=inline&show_copy_link=true" 
            title="Portcullis | Magic Links for Enterprise Data Sharing" 
            className="w-full h-full rounded-lg" 
            frameBorder="0" 
            loading="lazy" 
            allowFullScreen 
            allow="clipboard-write"
          ></iframe>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="bg-gray-50 rounded-lg p-6 mt-6 max-h-[250px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all space-y-3 text-center"
            >
              <div className="flex justify-center mb-3">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}