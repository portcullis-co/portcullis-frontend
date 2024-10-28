import React from 'react'
import { Bell, User } from 'lucide-react'
import { ModeToggle } from '@/components/theme-selector'

const Header = () => {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold text-black mb-2 md:mb-0">Welcome, User</h2>
        <div className="flex items-center space-x-4">
          <ModeToggle />
          <button className="text-black hover:text-gray-600">
            <Bell size={20} />
          </button>
          <button className="text-black hover:text-gray-600">
            <User size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header