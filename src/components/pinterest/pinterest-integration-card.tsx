'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Loader, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Play,
  Square
} from 'lucide-react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

interface PinterestIntegrationCardProps {
  className?: string;
}

export const PinterestIntegrationCard: React.FC<PinterestIntegrationCardProps> = ({ 
  className = '' 
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [mcpServerRunning, setMcpServerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate checking MCP server status
  useEffect(() => {
    if (isEnabled) {
      checkMcpServerStatus();
    }
  }, [isEnabled]);

  const checkMcpServerStatus = async () => {
    try {
      // Check if MCP server is running (you'd implement actual check)
      // For now, simulate
      setMcpServerRunning(false);
    } catch (err) {
      console.error('Failed to check MCP server status:', err);
    }
  };

  const handleToggle = useCallback(async (enabled: boolean) => {
    setIsEnabled(enabled);
    setError(null);

    if (enabled) {
      await connectPinterest();
    } else {
      await disconnectPinterest();
    }
  }, []);

  const connectPinterest = async () => {
    setStatus('connecting');

    try {
      // Start MCP server first
      await startMcpServer();
      
      // Then initiate OAuth flow
      setStatus('authenticating');
      await initiateOAuthFlow();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
      setIsEnabled(false);
    }
  };

  const disconnectPinterest = async () => {
    setStatus('disconnected');
    setAccessToken(null);
    setMcpServerRunning(false);
    await stopMcpServer();
  };

  const startMcpServer = async () => {
    // In a real implementation, this would start your Pinterest MCP server
    return new Promise((resolve) => {
      setTimeout(() => {
        setMcpServerRunning(true);
        resolve(true);
      }, 1000);
    });
  };

  const stopMcpServer = async () => {
    // Stop the MCP server
    return new Promise((resolve) => {
      setTimeout(() => {
        setMcpServerRunning(false);
        resolve(true);
      }, 500);
    });
  };

  const initiateOAuthFlow = async () => {
    // Open Pinterest OAuth in new window
    const authUrl = `https://www.pinterest.com/oauth/?` + new URLSearchParams({
      response_type: 'code',
      redirect_uri: 'http://localhost:8085/',
      client_id: '1515331',
      scope: 'user_accounts:read,pins:read,boards:read',
      state: 'pinterest_oauth_state'
    }).toString();

    // Open OAuth window
    const authWindow = window.open(
      authUrl, 
      'pinterest_auth', 
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    // Listen for OAuth completion (you'd implement proper message handling)
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'pinterest_auth_success') {
        setAccessToken(event.data.access_token);
        setStatus('connected');
        authWindow?.close();
        window.removeEventListener('message', handleAuthMessage);
      } else if (event.data.type === 'pinterest_auth_error') {
        setError('Authentication failed');
        setStatus('error');
        setIsEnabled(false);
        authWindow?.close();
        window.removeEventListener('message', handleAuthMessage);
      }
    };

    window.addEventListener('message', handleAuthMessage);

    // For demo purposes, simulate successful auth after 3 seconds
    setTimeout(() => {
      setAccessToken('demo_access_token');
      setStatus('connected');
      authWindow?.close();
      window.removeEventListener('message', handleAuthMessage);
    }, 3000);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'connecting':
      case 'authenticating':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Starting MCP Server...';
      case 'authenticating':
        return 'Authenticating with Pinterest...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'connecting':
      case 'authenticating':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className={`relative hover:border-foreground/20 transition-colors bg-white ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Pinterest Integration</h3>
            <p className="text-sm text-gray-600">Connect to Pinterest for visual search</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={status === 'connecting' || status === 'authenticating'}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          
          <Badge className={`${getStatusColor()}`}>
            {status.toUpperCase()}
          </Badge>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Connection Details */}
        {isEnabled && (
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">MCP Server:</span>
                <div className="flex items-center space-x-1 mt-1">
                  {mcpServerRunning ? (
                    <Play className="h-3 w-3 text-green-500" />
                  ) : (
                    <Square className="h-3 w-3 text-gray-400" />
                  )}
                  <span className={mcpServerRunning ? 'text-green-600' : 'text-gray-400'}>
                    {mcpServerRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-gray-600">Authentication:</span>
                <div className="flex items-center space-x-1 mt-1">
                  {accessToken ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-400" />
                  )}
                  <span className={accessToken ? 'text-green-600' : 'text-gray-400'}>
                    {accessToken ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://developers.pinterest.com/apps/', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Pinterest Console
              </Button>
              
              {accessToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkMcpServerStatus}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh Status
                </Button>
              )}
            </div>

            {/* Available Tools Preview */}
            {status === 'connected' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Settings className="h-4 w-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">Available Tools</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded px-2 py-1 border">
                    search_pinterest_pins
                  </div>
                  <div className="bg-white rounded px-2 py-1 border">
                    get_user_boards
                  </div>
                  <div className="bg-white rounded px-2 py-1 border">
                    get_board_pins
                  </div>
                  <div className="bg-white rounded px-2 py-1 border">
                    get_pinterest_pin
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};