"use client";

import { useState, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UsernameAuthWrapperProps {
  children: ReactNode;
}

export function UsernameAuthWrapper({ children }: UsernameAuthWrapperProps) {
  const { data: session, isPending } = authClient.useSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up with username as email (Better Auth requires email field)
        await authClient.signUp.email({
          email: `${username}@twitter.local`, // Fake email domain
          password,
          name: username,
          callbackURL: "/chat",
        });
      } else {
        // Sign in
        await authClient.signIn.email({
          email: `${username}@twitter.local`,
          password,
          callbackURL: "/chat",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <Card className="w-full max-w-md bg-[var(--sidebar)] text-[var(--foreground)] border border-[var(--sidebar-border)]">
          <CardHeader className="text-center">
            <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "Enter your Twitter username to create an account"
                : "Enter your Twitter username and password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Twitter Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="@username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace("@", ""))}
                  required
                  disabled={loading}
                  className="bg-[var(--popover)] text-[var(--foreground)] border border-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:ring-0 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-[var(--popover)] text-[var(--foreground)] border border-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:ring-0 focus:outline-none"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                disabled={loading}
              >
                {loading ? "Loading..." : (isSignUp ? "Create Account" : "Sign In")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[var(--foreground)] hover:text-[var(--foreground)] hover:opacity-80"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                disabled={loading}
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
