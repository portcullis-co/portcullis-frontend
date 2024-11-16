"use client"
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowUpRight, DollarSign, Database, Activity, TrendingUp, Users, Clock } from 'lucide-react';
import BoxReveal from "@/components/ui/box-reveal";
import { useOrganization, useAuth, useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const firstName = useUser().user?.firstName
  const org = useOrganization().organization?.name
  const logo = useOrganization().organization?.imageUrl
  return (
    <div className="size-full max-w-lg items-center justify-center overflow-hidden pt-8">
      <BoxReveal boxColor={"#faff69"} duration={0.5}>
        <p className="text-[3.5rem] font-semibold">
          Welcome <span className="text-black]">{firstName}!</span>
        </p>
      </BoxReveal>
 
      <BoxReveal boxColor={"black"} duration={0.5}>
        <h2 className="mt-[.5rem] text-[1rem]">
          You're almost ready to set up exports for {" "}
          <span className="text-black">{org}</span>
          <img src={logo} alt="Organization Logo" className="inline-block h-10 mb-1 w-10" />
        </h2>
      </BoxReveal>
 
      <BoxReveal boxColor={"black"} duration={0.5}>
        <div className="mt-6">
          <p>
            After a short onboarding, you'll be ready to embed data export functionality from your Clickhouse instance to Snowflake <img src="https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B" alt="Organization Logo" className="inline-block h-5 w-5" />, Redshift <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROFfEqplM57B_cRPv1fdRn8tBFTrqX57n5Bg&s" alt="Organization Logo" className="inline-block h-5 w-5" />, Bigquery <img src="https://cdn.worldvectorlogo.com/logos/google-bigquery-logo-1.svg" alt="Organization Logo" className="inline-block h-5 w-5" />, and a growing list of other destinations. 
          </p>
        </div>
      </BoxReveal>
 
      <BoxReveal boxColor={"#faff69"} duration={0.5}>
        <Button className="mt-[1.6rem] text-[#faff69] bg-black">Explore</Button>
      </BoxReveal>
    </div>
  );
}