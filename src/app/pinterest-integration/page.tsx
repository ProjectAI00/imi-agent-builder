'use client';

import { PinterestIntegrationCard } from '@/components/pinterest/pinterest-integration-card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PinterestIntegrationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/interactables" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pinterest Integration
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Connect your Pinterest account to enable AI-powered visual search, pin recommendations, 
            and board management directly in your chat conversations.
          </p>
        </div>

        {/* Integration Card */}
        <div className="mb-8">
          <PinterestIntegrationCard />
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            What you can do with Pinterest Integration
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">Visual Search</h3>
                  <p className="text-sm text-gray-600">
                    Ask AI to find pins by describing what you're looking for: "Show me modern kitchen designs" or "Find cozy bedroom ideas"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">Board Management</h3>
                  <p className="text-sm text-gray-600">
                    View and explore your Pinterest boards directly in chat, without leaving the conversation
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">Visual Results</h3>
                  <p className="text-sm text-gray-600">
                    Get beautiful Pinterest-style pin grids instead of text descriptions
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">Inspiration Discovery</h3>
                  <p className="text-sm text-gray-600">
                    Discover new ideas and trends based on your interests and search history
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">Direct Links</h3>
                  <p className="text-sm text-gray-600">
                    Click on any pin to visit the original source and save it to your boards
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-medium text-gray-900">AI-Powered Recommendations</h3>
                  <p className="text-sm text-gray-600">
                    Get personalized pin suggestions based on your conversation context
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Queries */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Try these example queries
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Search & Discovery</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>"Show me modern living room ideas"</p>
                <p>"Find sustainable fashion inspiration"</p>
                <p>"Search for easy dinner recipes"</p>
                <p>"Display wedding decoration trends"</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Board Management</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>"Show me my Pinterest boards"</p>
                <p>"Display pins from my Home Decor board"</p>
                <p>"What's in my Recipe collection?"</p>
                <p>"Show pins from my Travel board"</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}