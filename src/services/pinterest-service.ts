// Pinterest service functions for Tambo tools integration
import axios from 'axios';

export interface PinterestPin {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  link: string | null;
  boardName?: string;
  createdAt: string;
  isVideo?: boolean;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description: string | null;
  pinCount: number;
  createdAt: string;
}

// Use Next.js API routes instead of direct Pinterest API calls
const apiClient = axios.create({
  baseURL: '/api/pinterest',
  headers: {
    'Content-Type': 'application/json',
  },
});


export async function searchPinterestPins(params: {
  query: string;
  limit?: number;
}): Promise<{ query: string; pins: PinterestPin[] }> {
  const { query, limit = 25 } = params;
  
  try {
    console.log(`[FRONTEND SERVICE] Searching Pinterest for: "${query}"`);
    
    const response = await apiClient.get('/search', {
      params: {
        query,
        limit: Math.min(limit, 50),
      },
    });
    
    console.log(`[FRONTEND SERVICE] Found ${response.data.pins.length} Pinterest pins`);
    
    return response.data;
  } catch (error: any) {
    console.error('[FRONTEND SERVICE] Pinterest search failed:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    return {
      query,
      pins: [],
    };
  }
}

export async function getUserBoards(params: {
  limit?: number;
} = {}): Promise<{ boards: PinterestBoard[] }> {
  const { limit = 25 } = params;
  
  console.log('[FRONTEND SERVICE] getUserBoards called with limit:', limit);
  console.log('[FRONTEND SERVICE] This should NOT be called if MCP server is working');
  
  try {
    console.log(`[FRONTEND SERVICE] Getting user's Pinterest boards`);
    
    const response = await apiClient.get('/boards', {
      params: {
        limit: Math.min(limit, 100),
      },
    });
    
    console.log(`[FRONTEND SERVICE] Found ${response.data.boards.length} Pinterest boards`);
    
    return response.data;
  } catch (error: any) {
    console.error('[FRONTEND SERVICE] Pinterest boards failed:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    return {
      boards: [],
    };
  }
}

export async function getBoardPins(params: {
  boardId: string;
  limit?: number;
}): Promise<{ boardId: string; pins: PinterestPin[] }> {
  const { boardId, limit = 25 } = params;
  
  try {
    console.log(`[FRONTEND SERVICE] Getting pins from Pinterest board: ${boardId}`);
    
    const response = await apiClient.get(`/boards/${boardId}/pins`, {
      params: {
        limit: Math.min(limit, 100),
      },
    });
    
    console.log(`[FRONTEND SERVICE] Found ${response.data.pins.length} Pinterest pins from board`);
    
    return response.data;
  } catch (error: any) {
    console.error('[FRONTEND SERVICE] Pinterest board pins failed:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    return {
      boardId,
      pins: [],
    };
  }
}
