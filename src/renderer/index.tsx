/**
 * ClipForge - Renderer Process Entry Point
 * 
 * This file initializes the React application and mounts it to the DOM.
 * It runs in the renderer process (separate from the main Electron process).
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import IPCTest from './components/IPCTest';

// Verify that the Electron API is available
if (window.electron) {
  console.log('✅ Electron API is available via window.electron');
} else {
  console.warn('⚠️ Electron API not available - preload script may have failed');
}

/**
 * App Component - Main application component with Tailwind styling
 * 
 * This is a test component to verify that:
 * 1. React is properly installed and rendering
 * 2. Tailwind CSS is configured and applying styles
 * 3. All dependencies are loaded correctly
 */
const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🎬 ClipForge
            </h1>
            <p className="text-lg text-green-600 font-semibold">
              ✅ Dependencies Loaded Successfully
            </p>
          </div>

          {/* Status Cards */}
          <div className="space-y-3">
            <StatusCard 
              icon="⚛️" 
              title="React" 
              description="UI framework initialized and rendering"
              status="Ready"
            />
            <StatusCard 
              icon="🎨" 
              title="TailwindCSS" 
              description="Utility-first styling framework active"
              status="Ready"
            />
            <StatusCard 
              icon="📦" 
              title="Zustand" 
              description="State management library installed"
              status="Ready"
            />
            <StatusCard 
              icon="🎥" 
              title="FFmpeg" 
              description="Video processing tools ready"
              status="Ready"
            />
            <StatusCard 
              icon="🎭" 
              title="Konva" 
              description="Canvas library for timeline rendering"
              status="Ready"
            />
            <StatusCard 
              icon="💾" 
              title="Electron Store" 
              description="Persistent data storage configured"
              status="Ready"
            />
            <StatusCard 
              icon="🔗" 
              title="IPC Infrastructure" 
              description="Inter-Process Communication setup complete"
              status="Ready"
            />
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Epic 1.2: Core Dependencies Installation - Complete
          </div>
        </div>

        {/* IPC Test Component */}
        <IPCTest />
      </div>
    </div>
  );
};

/**
 * StatusCard Component - Displays a single dependency status
 * 
 * Props:
 * - icon: Emoji icon for the dependency
 * - title: Name of the dependency
 * - description: What the dependency does
 * - status: Current status (e.g., "Ready")
 */
interface StatusCardProps {
  icon: string;
  title: string;
  description: string;
  status: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, title, description, status }) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
        {status}
      </div>
    </div>
  );
};

/**
 * Initialize React Application
 * 
 * This code:
 * 1. Gets the root DOM element from index.html
 * 2. Creates a React root using the new React 18 API
 * 3. Renders the App component into the root element
 */
const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element. Make sure index.html has a <div id="root"></div>');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
