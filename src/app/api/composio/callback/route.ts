import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    
    // Log everything Composio sends back
    console.log("=== Composio OAuth Callback ===");
    console.log("Full URL:", req.url);
    console.log("Search Params:", Object.fromEntries(searchParams.entries()));
    
    // Extract common OAuth parameters
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const success = searchParams.get("success");
    const toolkit = searchParams.get("toolkit");
    const connectedAccountId = searchParams.get("connected_account_id");
    
    // If there's an error, log it and redirect with error
    if (error) {
      console.error("OAuth Error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(`/chat?auth_error=${error}&message=${errorDescription || "Unknown error"}`, req.url)
      );
    }
    
    // Log what we extracted
    console.log("Extracted data:", {
      code: code ? "present" : "missing",
      state: state ? "present" : "missing",
      success,
      toolkit,
      connectedAccountId
    });

    // Note: Composio manages user sessions internally via the Tool Router session URL
    // The connection is already linked to the correct user through their session
    // We don't need to manually update our database here - the next tool call will work

    console.log("✓ OAuth completed successfully - connection linked via Composio session");
    
    // For popup OAuth flow - close popup and notify parent
    const isPopup = searchParams.get("popup") === "true" || req.headers.get("referer")?.includes("oauth-popup");

    if (isPopup || true) { // Always treat as popup for better UX
      // Return HTML that notifies parent window and closes popup
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Complete</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .success {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .checkmark {
                color: #10b981;
                font-size: 3rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <div class="checkmark">✓</div>
              <h2>Authentication Complete!</h2>
              <p>This window will close automatically...</p>
            </div>
            <script>
              // Notify parent window
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth-complete',
                  success: ${success === "true" || !!code},
                  toolkit: '${toolkit || ""}',
                  connectedAccountId: '${connectedAccountId || ""}'
                }, '*');
              }
              // Close popup after a short delay
              setTimeout(() => window.close(), 1500);
            </script>
          </body>
        </html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    
  } catch (error) {
    console.error("Callback handler error:", error);
    
    // Redirect with generic error
    return NextResponse.redirect(
      new URL("/chat?auth_error=callback_failed", req.url)
    );
  }
}

