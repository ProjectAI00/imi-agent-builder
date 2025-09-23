import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

export const PinSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.object({
    '600x': z.object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    'original': z.object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }).optional(),
  }),
  link: z.string().nullable(),
  board: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  created_at: z.string(),
});

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  pin_count: z.number(),
  created_at: z.string(),
});

export type Pin = z.infer<typeof PinSchema>;
export type Board = z.infer<typeof BoardSchema>;

export class PinterestAPI {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: 'https://api.pinterest.com/v5',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async searchPins(query: string, limit: number = 25): Promise<Pin[]> {
    try {
      const response = await this.client.get('/pins/search', {
        params: {
          query,
          limit: Math.min(limit, 50), // Pinterest API max limit
        },
      });

      const pins = response.data.items || [];
      return pins.map((pin: any) => PinSchema.parse(pin));
    } catch (error) {
      console.error('Pinterest API search error:', error);
      throw new Error(`Failed to search Pinterest pins: ${error}`);
    }
  }

  async getUserBoards(limit: number = 25): Promise<Board[]> {
    try {
      const response = await this.client.get('/boards', {
        params: {
          limit: Math.min(limit, 100),
        },
      });

      const boards = response.data.items || [];
      return boards.map((board: any) => BoardSchema.parse(board));
    } catch (error) {
      console.error('Pinterest API boards error:', error);
      throw new Error(`Failed to fetch Pinterest boards: ${error}`);
    }
  }

  async getBoardPins(boardId: string, limit: number = 25): Promise<Pin[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/pins`, {
        params: {
          limit: Math.min(limit, 100),
        },
      });

      const pins = response.data.items || [];
      return pins.map((pin: any) => PinSchema.parse(pin));
    } catch (error) {
      console.error('Pinterest API board pins error:', error);
      throw new Error(`Failed to fetch pins from board: ${error}`);
    }
  }

  async getPin(pinId: string): Promise<Pin> {
    try {
      const response = await this.client.get(`/pins/${pinId}`);
      return PinSchema.parse(response.data);
    } catch (error) {
      console.error('Pinterest API pin error:', error);
      throw new Error(`Failed to fetch Pinterest pin: ${error}`);
    }
  }
}