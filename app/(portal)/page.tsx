import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowUpRight, DollarSign, Database, Activity, TrendingUp, Users, Clock } from 'lucide-react';

// Define the type for the metric card props
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}

// Define the type for the KPI item props
interface KPIItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: number;
}

export default function DashboardPage() {
  // Mock data for the metrics
  const metrics = {
    monthlyRows: 1000000,
    totalETLCost: 500,
    topDataSource: "Google Ads",
    dataWarehousesConnected: 3,
  };

  // Mock data for KPIs
  const kpis: KPIItemProps[] = [
    { label: "Data Syncs", value: 1234, icon: <TrendingUp className="h-4 w-4" />, trend: 5.6 },
    { label: "Active Connections", value: 24, icon: <Users className="h-4 w-4" />, trend: -2.3 },
    { label: "Avg. Sync Time", value: "2.5s", icon: <Clock className="h-4 w-4" />, trend: -0.8 },
  ];

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monthly Rows"
          value={metrics.monthlyRows.toLocaleString()}
          icon={<Database className="h-4 w-4" />}
          description="Total rows processed this month"
        />
        <MetricCard
          title="Total Reverse ETL Cost"
          value={`$${metrics.totalETLCost.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
          description="Cost of Reverse ETL operations"
        />
        <MetricCard
          title="Top Data Source"
          value={metrics.topDataSource}
          icon={<Activity className="h-4 w-4" />}
          description="Top data source for Reverse ETL"
        />
        <MetricCard
          title="Data Warehouses"
          value={metrics.dataWarehousesConnected}
          icon={<Database className="h-4 w-4" />}
          description="Connected data warehouses"
        />
      </div>

      <h2 className="text-2xl font-semibold mb-4">Key Performance Indicators</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => (
          <KPIItem key={index} {...kpi} />
        ))}
      </div>

      <div className="flex justify-end">
      </div>
    </div>
  );
}

// Use the MetricCardProps interface for the component props
function MetricCard({ title, value, icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function KPIItem({ label, value, icon, trend }: KPIItemProps) {
  const trendColor = trend >= 0 ? "text-green-500" : "text-red-500";
  const trendIcon = trend >= 0 ? "↑" : "↓";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-sm ${trendColor}`}>
          {trendIcon} {Math.abs(trend)}%
        </p>
      </CardContent>
    </Card>
  );
}