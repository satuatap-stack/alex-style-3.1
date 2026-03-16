/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
  videoUrl?: string; // Optional generated video for this layer/pose
}

export interface ThemeResult {
  themeId: string;
  themeName: string;
  imageUrl: string;
}

export interface VideoSettings {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  seed?: number;
}

export interface VideoGenerationResult {
  videoUrl: string;
  prompt: string;
  settings: VideoSettings;
}

export type AIProvider = 'gemini' | 'openrouter' | 'grok' | 'openai';

export interface AppSettings {
  imageProvider: AIProvider;
  imageApiKey: string;
  imageModel?: string;
  videoProvider: AIProvider;
  videoApiKey: string;
  videoModel?: string;
  useDefaultGemini: boolean;
  useDefaultVeo: boolean;
}
