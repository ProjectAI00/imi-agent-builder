"use client";

import { useState } from "react";

export default function TestOAuthCallback() {
  const [testParams, setTestParams] = useState({
    success: "true",
    toolkit: "gmail",
    connected_account_id: "acc_test123",
    state: "",
    code: "",
  });

  const simulateCallback = () => {
    const params = new URLSearchParams();
    
    Object.entries(testParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const callbackUrl = `/api/composio/callback?${params.toString()}`;
    console.log("Simulating callback to:", callbackUrl);
    window.location.href = callbackUrl;
  };

  const simulateError = () => {
    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "User cancelled the authorization"
    });

    const callbackUrl = `/api/composio/callback?${params.toString()}`;
    console.log("Simulating error callback to:", callbackUrl);
    window.location.href = callbackUrl;
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test OAuth Callback</h1>
      
      <p className="mb-6 text-gray-600">
        This page lets you manually test the OAuth callback route by simulating
        what Composio would send after a successful or failed OAuth flow.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Success</label>
          <input
            type="text"
            value={testParams.success}
            onChange={(e) => setTestParams({ ...testParams, success: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="true"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Toolkit</label>
          <input
            type="text"
            value={testParams.toolkit}
            onChange={(e) => setTestParams({ ...testParams, toolkit: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="gmail"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Connected Account ID</label>
          <input
            type="text"
            value={testParams.connected_account_id}
            onChange={(e) => setTestParams({ ...testParams, connected_account_id: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="acc_123abc"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">State (optional)</label>
          <input
            type="text"
            value={testParams.state}
            onChange={(e) => setTestParams({ ...testParams, state: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="user_id or base64_encoded_json"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty or provide userId or base64 encoded JSON
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Code (optional OAuth code)</label>
          <input
            type="text"
            value={testParams.code}
            onChange={(e) => setTestParams({ ...testParams, code: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="oauth_code_here"
          />
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={simulateCallback}
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Simulate Success Callback
        </button>

        <button
          onClick={simulateError}
          className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Simulate Error Callback
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">What happens:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Redirects to <code>/api/composio/callback</code> with parameters</li>
          <li>Callback logs everything to console (check terminal)</li>
          <li>Updates Convex database (if toolkit + userId provided)</li>
          <li>Redirects back to <code>/chat</code> with success/error params</li>
        </ol>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Check console for:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Full callback URL</li>
          <li>All received parameters</li>
          <li>Decoded state (if provided)</li>
          <li>Database update status</li>
          <li>Redirect URL</li>
        </ul>
      </div>
    </div>
  );
}

