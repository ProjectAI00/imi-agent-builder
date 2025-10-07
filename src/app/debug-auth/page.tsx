"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function DebugAuthPage() {
  const authUsers = useQuery(api.debug.checkAuthUsers.listAuthUsers);
  const legacyUsers = useQuery(api.debug.checkAuthUsers.listLegacyUsers);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState("");

  const createTestUser = async () => {
    setCreating(true);
    setResult("");
    
    try {
      await authClient.signUp.email({
        email: "advicebyaimar@twitter.local",
        password: "test123", // Change this to your actual password
        name: "advicebyaimar",
      });
      setResult("✓ User created successfully! Try logging in now.");
    } catch (error) {
      setResult(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Debug Page</h1>

      <div className="space-y-6">
        {/* Better Auth Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Better Auth Users (authUsers table)</h2>
          <p className="text-sm text-gray-600 mb-4">
            This is what the login system checks. Your username gets converted to an email.
          </p>
          
          {authUsers === undefined ? (
            <p className="text-gray-500">Loading...</p>
          ) : authUsers.length === 0 ? (
            <div>
              <p className="text-red-600 font-medium">No users found!</p>
              <p className="text-sm text-gray-600 mt-2">
                This is why login fails. You need to sign up first.
              </p>
              
              <button
                onClick={createTestUser}
                disabled={creating}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Test User (advicebyaimar)"}
              </button>
              
              {result && (
                <p className={`mt-2 text-sm ${result.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {result}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {authUsers.map((user) => (
                <div key={user.id} className="border rounded p-3 bg-gray-50">
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-gray-600">Name: {user.name || "N/A"}</p>
                  <p className="text-xs text-gray-500">Created: {user.createdAt}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legacy Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Legacy Users (users table)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Old system, not used for login anymore.
          </p>
          
          {legacyUsers === undefined ? (
            <p className="text-gray-500">Loading...</p>
          ) : legacyUsers.length === 0 ? (
            <p className="text-gray-500">No legacy users found</p>
          ) : (
            <div className="space-y-2">
              {legacyUsers.map((user) => (
                <div key={user.id} className="border rounded p-3 bg-gray-50">
                  <p className="font-medium">@{user.username}</p>
                  <p className="text-sm text-gray-600">Email: {user.email || "N/A"}</p>
                  <p className="text-xs text-gray-500">Created: {user.createdAt}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How Login Works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>You enter username: <code>advicebyaimar</code></li>
            <li>System converts to: <code>advicebyaimar@twitter.local</code></li>
            <li>Searches in authUsers table for this email</li>
            <li>If found → login succeeds</li>
            <li>If not found → shows "User not found"</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded">
            <p className="font-semibold text-sm mb-1">To fix:</p>
            <p className="text-sm">
              If authUsers table is empty above, click "Create Test User" or go back to the 
              login page and click <strong>"Don't have an account? Sign up"</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

