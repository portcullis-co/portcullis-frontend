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
    <div className="flex h-screen bg-white">
      <Sidebar openWarehouseConnection={() => {}} openAppsConnection={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-6">
          <h1 className="text-3xl font-semibold text-black mb-6">Dashboard</h1>
          {children}
        </main>
      </div>
    </div>
  )
}