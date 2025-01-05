"use client"
import React from 'react'
import { TableComponent } from '@/components/v0-table-component'
import Sidebar from '@/components/dashboard/sidebar'
import Header from '@/components/dashboard/header'
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <Sidebar openWarehouseConnection={() => {}} openAppsConnection={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}