'use client';

import React from 'react';

/**
 * @module SettingsCard
 * @description Card-based wrapper for individual settings with icon, title, description, and control area.
 * @responsibility Provides consistent visual wrapper for settings sections across the app.
 * @boundary_rules
 * - ✅ Pure UI component, no business logic.
 * - ✅ Accepts icon component, title, description and arbitrary children for controls.
 */
interface SettingsCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Card wrapper displaying icon, title, description, and control area.
 * 
 * @param icon - Lucide icon component to display next to the title
 * @param title - Bold title for the setting section
 * @param description - Muted description text explaining the setting
 * @param children - React nodes for the control input(s)
 */
export function SettingsCard({ icon: Icon, title, description, children }: SettingsCardProps) {
  return (
    <div className="bg-themed-inner border border-themed-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-accent-sage" />
        <h3 className="text-lg font-bold text-themed-fg-main">{title}</h3>
      </div>
      <p className="text-sm text-themed-fg-muted">{description}</p>
      {children}
    </div>
  );
}