import React from 'react'
import Link from 'next/link'
import { Buildings, ShieldStar, Users } from '@phosphor-icons/react/dist/ssr'

export default function AdminPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to the Admin Portal</h1>
          <p className="text-white/60 text-lg max-w-lg mx-auto">
            Choose where you want to go. You can manage course content or configure platform-level settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Course Dashboard Card */}
          <Link 
            href="/dash"
            className="group relative flex flex-col items-center text-center p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="h-16 w-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Buildings size={32} weight="fill" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Course Dashboard</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Manage courses, enrollments, student progress, activities, and organization branding.
            </p>
          </Link>

          {/* Superadmin Dashboard Card */}
          <Link 
            href="/admin/users"
            className="group relative flex flex-col items-center text-center p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="h-16 w-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Users size={32} weight="fill" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Superadmin Dashboard</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Platform-level settings, superadmin account management, and system-wide configurations.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
