import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '25');

    // Mock Pinterest pins data
    const mockPins = [
      {
        id: '1234567890',
        title: 'Modern Kitchen Design Ideas',
        description: 'Beautiful modern kitchen with white cabinets, marble countertops, and gold accents. Perfect inspiration for your next home renovation.',
        imageUrl: 'https://i.pinimg.com/600x315/17/f9/c3/17f9c3a5b1c6d5e0f8b7a4c2d9e1f2a3.jpg',
        imageWidth: 600,
        imageHeight: 315,
        link: 'https://example.com/kitchen-design',
        boardName: 'Kitchen Inspiration',
        createdAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2345678901',
        title: 'Scandinavian Living Room',
        description: 'Minimalist Scandinavian living room with natural light, plants, and cozy textures. Clean lines and neutral colors create a peaceful atmosphere.',
        imageUrl: 'https://i.pinimg.com/600x400/a1/b2/c3/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.jpg',
        imageWidth: 600,
        imageHeight: 400,
        link: 'https://example.com/scandinavian-design',
        boardName: 'Home Decor',
        createdAt: '2024-02-20T14:15:00Z',
      },
      {
        id: '3456789012',
        title: 'Garden Design Inspiration',
        description: 'Lush garden with colorful flowers, stone pathways, and outdoor seating. Perfect for creating your own backyard paradise.',
        imageUrl: 'https://i.pinimg.com/600x450/f1/e2/d3/f1e2d3c4b5a6g7h8i9j0k1l2m3n4o5p6.jpg',
        imageWidth: 600,
        imageHeight: 450,
        link: 'https://example.com/garden-design',
        boardName: 'Outdoor Spaces',
        createdAt: '2024-03-10T09:45:00Z',
      },
      {
        id: '4567890123',
        title: 'Modern Bathroom Ideas',
        description: 'Spa-like bathroom with freestanding tub, natural materials, and clean lines. Transform your bathroom into a relaxing retreat.',
        imageUrl: 'https://i.pinimg.com/600x600/b3/c4/d5/b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8.jpg',
        imageWidth: 600,
        imageHeight: 600,
        link: 'https://example.com/bathroom-design',
        boardName: 'Bathroom Renovation',
        createdAt: '2024-01-25T16:20:00Z',
      },
      {
        id: '5678901234',
        title: 'Cozy Bedroom Decor',
        description: 'Warm and inviting bedroom with soft textures, layered lighting, and natural elements. Create the perfect sleep sanctuary.',
        imageUrl: 'https://i.pinimg.com/600x400/e5/f6/g7/e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.jpg',
        imageWidth: 600,
        imageHeight: 400,
        link: 'https://example.com/bedroom-decor',
        boardName: 'Bedroom Ideas',
        createdAt: '2024-02-05T11:30:00Z',
      },
    ];

    // Filter pins based on query if provided
    const filteredPins = query 
      ? mockPins.filter(pin => 
          pin.title?.toLowerCase().includes(query.toLowerCase()) ||
          pin.description?.toLowerCase().includes(query.toLowerCase()) ||
          pin.boardName?.toLowerCase().includes(query.toLowerCase())
        )
      : mockPins;

    console.log(`🔍 Pinterest search for "${query}" returned ${filteredPins.length} pins`);

    return NextResponse.json({
      query,
      pins: filteredPins.slice(0, Math.min(limit, 50)),
    });
  } catch (error) {
    console.error('Pinterest search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search Pinterest pins' },
      { status: 500 }
    );
  }
}
