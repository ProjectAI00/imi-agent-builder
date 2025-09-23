import { Pin, Board } from './pinterest-api.js';

// Mock Pinterest data for development/demo
const mockPins: Pin[] = [
  {
    id: '1234567890',
    title: 'Modern Kitchen Design Ideas',
    description: 'Beautiful modern kitchen with white cabinets, marble countertops, and gold accents. Perfect inspiration for your next home renovation.',
    image: {
      '600x': {
        url: 'https://i.pinimg.com/600x315/17/f9/c3/17f9c3a5b1c6d5e0f8b7a4c2d9e1f2a3.jpg',
        width: 600,
        height: 315,
      },
      original: {
        url: 'https://i.pinimg.com/originals/17/f9/c3/17f9c3a5b1c6d5e0f8b7a4c2d9e1f2a3.jpg',
        width: 1200,
        height: 630,
      },
    },
    link: 'https://example.com/kitchen-design',
    board: {
      id: 'board123',
      name: 'Kitchen Inspiration',
    },
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: '2345678901',
    title: 'Scandinavian Living Room',
    description: 'Minimalist Scandinavian living room with natural light, plants, and cozy textures. Clean lines and neutral colors create a peaceful atmosphere.',
    image: {
      '600x': {
        url: 'https://i.pinimg.com/600x400/a1/b2/c3/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.jpg',
        width: 600,
        height: 400,
      },
      original: {
        url: 'https://i.pinimg.com/originals/a1/b2/c3/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.jpg',
        width: 1200,
        height: 800,
      },
    },
    link: 'https://example.com/scandinavian-design',
    board: {
      id: 'board456',
      name: 'Home Decor',
    },
    created_at: '2024-02-20T14:15:00Z',
  },
  {
    id: '3456789012',
    title: 'Garden Design Inspiration',
    description: 'Lush garden with colorful flowers, stone pathways, and outdoor seating. Perfect for creating your own backyard paradise.',
    image: {
      '600x': {
        url: 'https://i.pinimg.com/600x450/f1/e2/d3/f1e2d3c4b5a6g7h8i9j0k1l2m3n4o5p6.jpg',
        width: 600,
        height: 450,
      },
      original: {
        url: 'https://i.pinimg.com/originals/f1/e2/d3/f1e2d3c4b5a6g7h8i9j0k1l2m3n4o5p6.jpg',
        width: 1200,
        height: 900,
      },
    },
    link: 'https://example.com/garden-design',
    board: {
      id: 'board789',
      name: 'Outdoor Spaces',
    },
    created_at: '2024-03-10T09:45:00Z',
  },
  {
    id: '4567890123',
    title: 'Modern Bathroom Ideas',
    description: 'Spa-like bathroom with freestanding tub, natural materials, and clean lines. Transform your bathroom into a relaxing retreat.',
    image: {
      '600x': {
        url: 'https://i.pinimg.com/600x600/b3/c4/d5/b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8.jpg',
        width: 600,
        height: 600,
      },
      original: {
        url: 'https://i.pinimg.com/originals/b3/c4/d5/b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8.jpg',
        width: 1200,
        height: 1200,
      },
    },
    link: 'https://example.com/bathroom-design',
    board: {
      id: 'board123',
      name: 'Bathroom Renovation',
    },
    created_at: '2024-01-25T16:20:00Z',
  },
  {
    id: '5678901234',
    title: 'Cozy Bedroom Decor',
    description: 'Warm and inviting bedroom with soft textures, layered lighting, and natural elements. Create the perfect sleep sanctuary.',
    image: {
      '600x': {
        url: 'https://i.pinimg.com/600x400/e5/f6/g7/e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.jpg',
        width: 600,
        height: 400,
      },
      original: {
        url: 'https://i.pinimg.com/originals/e5/f6/g7/e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.jpg',
        width: 1200,
        height: 800,
      },
    },
    link: 'https://example.com/bedroom-decor',
    board: {
      id: 'board456',
      name: 'Bedroom Ideas',
    },
    created_at: '2024-02-05T11:30:00Z',
  },
];

const mockBoards: Board[] = [
  {
    id: 'board123',
    name: 'Kitchen Inspiration',
    description: 'Beautiful kitchen designs and ideas for modern homes',
    pin_count: 45,
    created_at: '2023-12-01T00:00:00Z',
  },
  {
    id: 'board456',
    name: 'Home Decor',
    description: 'Interior design ideas and home decoration inspiration',
    pin_count: 128,
    created_at: '2023-11-15T00:00:00Z',
  },
  {
    id: 'board789',
    name: 'Outdoor Spaces',
    description: 'Garden design, patio ideas, and outdoor living inspiration',
    pin_count: 67,
    created_at: '2024-01-01T00:00:00Z',
  },
];

export class MockPinterestAPI {
  async searchPins(query: string, limit: number = 25): Promise<Pin[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Filter pins based on query (simple keyword matching)
    const filteredPins = mockPins.filter(pin => 
      pin.title?.toLowerCase().includes(query.toLowerCase()) ||
      pin.description?.toLowerCase().includes(query.toLowerCase())
    );
    
    return filteredPins.slice(0, Math.min(limit, 50));
  }

  async getUserBoards(limit: number = 25): Promise<Board[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockBoards.slice(0, Math.min(limit, 100));
  }

  async getBoardPins(boardId: string, limit: number = 25): Promise<Pin[]> {
    await new Promise(resolve => setTimeout(resolve, 250));
    
    const boardPins = mockPins.filter(pin => pin.board?.id === boardId);
    return boardPins.slice(0, Math.min(limit, 100));
  }

  async getPin(pinId: string): Promise<Pin> {
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const pin = mockPins.find(pin => pin.id === pinId);
    if (!pin) {
      throw new Error(`Pin not found: ${pinId}`);
    }
    return pin;
  }
}