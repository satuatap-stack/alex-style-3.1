/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { motion } from 'framer-motion';
import { ThemeResult } from '../types';
import { DownloadIcon, VideoIcon, GrokIcon, SaveIcon } from './icons';

interface ThemeGalleryProps {
  themes: ThemeResult[];
  isGenerating: boolean;
  onCreateVideo: (theme: ThemeResult) => void;
  onCreateCustomVideo: (theme: ThemeResult) => void;
}

const ThemeGallery: React.FC<ThemeGalleryProps> = ({ themes, isGenerating, onCreateVideo, onCreateCustomVideo }) => {
  const handleSaveAll = () => {
    themes.forEach((theme, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = theme.imageUrl;
        link.download = `outfit-${theme.themeId}-${index}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 200);
    });
  };

  if (!isGenerating && themes.length === 0) return null;

  return (
    <div className="w-full max-w-[95vw] mx-auto px-6 py-20 border-t border-gray-100 mt-20">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Koleksi Tema</h2>
            <span className="bg-indigo-50 text-indigo-600 text-xs font-black px-3 py-1 rounded-full">
              {themes.length} / 150
            </span>
          </div>
          <p className="text-gray-500 text-sm max-w-md">
            Jelajahi berbagai variasi gaya yang telah digenerate secara otomatis untuk model Anda.
          </p>
          {isGenerating && (
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-indigo-500 animate-pulse mt-1">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
              Sedang mengenerate variasi baru...
            </div>
          )}
        </div>
        
        {themes.length > 0 && (
          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-8 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95"
          >
            <SaveIcon className="w-5 h-5" />
            Simpan Semua Koleksi
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-4">
        {themes.map((theme, index) => (
          <motion.div
            key={theme.themeId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: (index % 10) * 0.05 }}
            className={`group relative flex flex-col bg-white rounded-[2rem] overflow-hidden border transition-all duration-500 ${
              index === 3 
                ? 'border-indigo-500 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.25)] ring-2 ring-indigo-500/10 scale-[1.05] z-10' 
                : 'border-gray-100 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1'
            }`}
          >
            {index === 3 && (
              <div className="absolute top-3 left-3 z-20 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg">
                Featured
              </div>
            )}
            <div className="aspect-[3/4] overflow-hidden bg-gray-50 relative">
              <img
                src={theme.imageUrl}
                alt={theme.themeName}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <button
                    onClick={() => onCreateCustomVideo(theme)}
                    className="p-2 bg-white/90 rounded-full hover:bg-white text-amber-600 transition-all scale-90 group-hover:scale-100"
                    title="Grok Video"
                  >
                    <GrokIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onCreateVideo(theme)}
                    className="p-2 bg-white/90 rounded-full hover:bg-white text-indigo-600 transition-all scale-90 group-hover:scale-100"
                    title="Video"
                  >
                    <VideoIcon className="w-4 h-4" />
                  </button>
              </div>
            </div>
            <div className="p-3 flex flex-col gap-2 bg-white">
              <p className={`text-[10px] font-bold truncate text-center ${index === 3 ? 'text-indigo-900' : 'text-gray-700'}`}>
                {theme.themeName}
              </p>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = theme.imageUrl;
                  link.download = `outfit-${theme.themeId}.png`;
                  link.click();
                }}
                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                <DownloadIcon className="w-3 h-3" />
                Simpan
              </button>
            </div>
          </motion.div>
        ))}

        {isGenerating && Array.from({ length: Math.max(0, 150 - themes.length) }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="aspect-[3/4] bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 flex items-center justify-center animate-pulse"
          >
            <div className="w-6 h-6 rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThemeGallery;
