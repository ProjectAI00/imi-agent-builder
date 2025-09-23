"use client";

import { usePinterestAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, loading, signIn, signOut, isAuthenticated } = usePinterestAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to Pinterest Chat</CardTitle>
            <CardDescription>
              Sign in to access personalized Pinterest data through AI chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={signIn}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.713-1.227s.365.696 1.156.696c1.554 0 2.604-1.417 2.604-3.312 0-2.125-1.146-3.479-2.958-3.479-2.229 0-3.354 1.604-3.354 2.938 0 .811.308 1.531.969 1.802.108.044.167.025.193-.07.02-.073.067-.271.088-.352.029-.107.018-.146-.063-.24-.177-.205-.289-.46-.289-.827 0-1.062.793-2.021 2.063-2.021 1.125 0 1.742.688 1.742 1.604 0 1.208-.531 2.229-1.323 2.229-.438 0-.765-.36-.659-.802.125-.526.369-1.093.369-1.474 0-.339-.183-.623-.563-.623-.447 0-.804.463-.804 1.083 0 .394.134.661.134.661s-.456 1.932-.535 2.268c-.159.673-.024 1.496-.013 1.58.007.051.072.063.102.025.042-.055.583-.723.764-1.375.051-.185.294-1.144.294-1.144.145.277.570.521 1.021.521 1.344 0 2.256-1.229 2.256-2.872 0-1.242-.993-2.396-2.501-2.396-1.874 0-2.875 1.344-2.875 2.604 0 .716.271 1.208.854 1.416.096.034.148.019.171-.053.017-.053.058-.228.076-.296.025-.093.015-.126-.054-.207-.15-.178-.246-.407-.246-.732 0-.943.704-1.789 1.833-1.789.999 0 1.55.611 1.55 1.426 0 1.071-.474 1.977-1.175 1.977-.389 0-.679-.321-.586-.713.111-.467.327-.971.327-1.308 0-.302-.162-.553-.498-.553-.395 0-.713.409-.713.958 0 .349.118.585.118.585s-.404 1.716-.474 2.008c-.141.585-.021 1.303-.011 1.377.006.043.064.054.09.021.037-.049.516-.64.677-1.221.046-.164.261-1.016.261-1.016.129.246.506.464.906.464 1.189 0 1.994-1.089 1.994-2.547 0-1.102-.881-2.122-2.222-2.122z"/>
              </svg>
              Continue with Pinterest
            </Button>
            <div className="text-xs text-gray-500 text-center">
              Connect your Pinterest account to access your boards and pins
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header removed; user controls live in the chat sidebar */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
