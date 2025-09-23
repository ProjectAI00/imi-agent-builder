'use client';

import { z } from 'zod';
import React from 'react';

export const pinterestBoardListSchema = z.object({
  boards: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      pinCount: z.number(),
      createdAt: z.string().optional(),
      previewImage: z.string().nullable().optional(),
    })
  ),
  title: z.string().optional(),
});

export type PinterestBoardListProps = z.infer<typeof pinterestBoardListSchema>;

export const PinterestBoardList: React.FC<PinterestBoardListProps> = ({
  boards,
  title,
}) => {
  if (!boards || boards.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No boards found</div>
          <div className="text-sm">Create your first board to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">
            {boards.length} {boards.length === 1 ? 'board' : 'boards'}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} />
        ))}
      </div>
    </div>
  );
};

interface BoardCardProps {
  board: PinterestBoardListProps['boards'][0];
}

const BoardCard: React.FC<BoardCardProps> = ({ board }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer">
      {/* Board Preview */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">        
        {/* Placeholder grid for board thumbnails */}
        <div className="absolute inset-0 p-2 flex">
          <div className="grid grid-cols-3 gap-1 h-full w-full">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`${board.id}-thumbnail-${index}`}
                className={`bg-gray-300 rounded-lg ${
                  index >= 3 ? 'opacity-50' : ''
                }`}
              />
            ))}
          </div>
        </div>
        
        {/* Pin count overlay */}
        <div className="absolute bottom-3 right-3 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-sm">
          {board.pinCount} pins
        </div>
      </div>
      
      {/* Board Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
          {board.name}
        </h3>
        
        {board.description && (
          <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed mb-3">
            {board.description}
          </p>
        )}
        
        {/* Board metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            <span>Board</span>
          </div>
          
          {board.createdAt && (
            <span>
              {new Date(board.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};