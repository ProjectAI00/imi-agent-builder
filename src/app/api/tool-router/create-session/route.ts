import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export async function POST(req: NextRequest) {
  try {
    const { userId, toolkits } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json(
        { error: "COMPOSIO_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://backend.composio.dev/api/v3/labs/tool_router/session",
      {
        method: "POST",
        headers: {
          "x-api-key": composioApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Composio API error: ${response.status} ${errorText}`);
    }

    const session = await response.json();

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL not configured");
    }

    await fetchMutation(
      api.toolRouter.sessions.create,
      {
        userId,
        sessionId: session.session_id,
        sessionUrl: session.chat_session_mcp_url || session.url,
        connectedToolkits: toolkits || [],
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      },
      { url: convexUrl }
    );

    return NextResponse.json({
      success: true,
      sessionId: session.session_id,
      sessionUrl: session.chat_session_mcp_url || session.url,
    });
  } catch (error) {
    console.error("Error creating Tool Router session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
