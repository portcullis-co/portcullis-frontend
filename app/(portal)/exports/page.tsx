'use client';

import { useOrganization } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { format } from "date-fns";

interface Export {
  id: string;
  internal_warehouse: string;
  destination_type: string;
  destination_name: string;
  scheduled_at: string;
  created_at: string;
}

export default function ExportsPage() {
  const [exports, setExports] = useState<Export[]>([]);
  const { organization } = useOrganization();
  
  useEffect(() => {
    const fetchExports = async () => {
      if (!organization) return;
      
      const response = await fetch(`/api/exports?organizationId=${organization.id}`);
      if (response.ok) {
        const data = await response.json();
        setExports(data);
      }
    };

    fetchExports();
  }, [organization]);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Active Exports</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Warehouse</TableHead>
            <TableHead>Destination Type</TableHead>
            <TableHead>Destination Name</TableHead>
            <TableHead>Scheduled For</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exports.map((exp) => (
            <TableRow key={exp.id}>
              <TableCell>{exp.internal_warehouse}</TableCell>
              <TableCell>{exp.destination_type}</TableCell>
              <TableCell>{exp.destination_name}</TableCell>
              <TableCell>
                {exp.scheduled_at ? format(new Date(exp.scheduled_at), 'PPp') : 'Not scheduled'}
              </TableCell>
              <TableCell>{format(new Date(exp.created_at), 'PP')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
