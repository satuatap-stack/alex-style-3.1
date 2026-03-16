
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AppSettings } from "../types";

const getSettings = (): AppSettings | null => {
    try {
        const saved = localStorage.getItem('app_settings');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

// Helper to get the correct AI instance or configuration
export const getAIInstance = (type: 'image' | 'video') => {
    const settings = getSettings();
    
    if (type === 'image') {
        if (settings && !settings.useDefaultGemini && settings.imageApiKey) {
            return { apiKey: settings.imageApiKey, provider: settings.imageProvider, model: settings.imageModel };
        }
        return { apiKey: process.env.GEMINI_API_KEY, provider: 'gemini', model: 'gemini-2.5-flash-image' };
    } else {
        if (settings && !settings.useDefaultVeo && settings.videoApiKey) {
            return { apiKey: settings.videoApiKey, provider: settings.videoProvider, model: settings.videoModel };
        }
        return { apiKey: process.env.API_KEY, provider: 'gemini', model: 'veo-3.1-fast-generate-preview' };
    }
};

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        const { mimeType, data } = part.inlineData;
                        return `data:${mimeType};base64,${data}`;
                    }
                }
            }
        }
    }

    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

// Helper to handle retries for 429 errors
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> => {
    let retries = 0;
    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            const isRateLimit = error?.message?.includes('429') || 
                               error?.status === 429 || 
                               error?.message?.includes('RESOURCE_EXHAUSTED');
            
            if (isRateLimit && retries < maxRetries) {
                retries++;
                const delay = initialDelay * Math.pow(2, retries - 1);
                console.log(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
};

// Universal helper to call different AI providers
const universalGenerateContent = async (params: {
    type: 'image' | 'video',
    model: string,
    contents: any,
    config?: any
}): Promise<GenerateContentResponse> => {
    const { apiKey, provider, model: customModel } = getAIInstance(params.type);
    
    if (!apiKey) throw new Error(`API Key for ${params.type} is not configured.`);

    if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey });
        return await ai.models.generateContent({
            model: customModel || params.model,
            contents: params.contents,
            config: params.config
        });
    } else {
        // OpenAI-compatible providers (OpenRouter, OpenAI)
        const baseUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 
                        'https://api.openai.com/v1';
        
        // Convert Gemini-style contents to OpenAI-style messages if possible
        const messages: any[] = [];
        const contents = Array.isArray(params.contents) ? params.contents : [params.contents];
        
        for (const content of contents) {
            const parts = Array.isArray(content.parts) ? content.parts : [content.parts];
            const messageContent: any[] = [];
            
            for (const part of parts) {
                if (part.text) {
                    messageContent.push({ type: 'text', text: part.text });
                } else if (part.inlineData) {
                    messageContent.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                        }
                    });
                }
            }
            messages.push({ role: 'user', content: messageContent });
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...(provider === 'openrouter' ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Virtual Try-On' } : {})
            },
            body: JSON.stringify({
                model: customModel || (provider === 'openrouter' ? `google/${params.model}` : 'gpt-4o'),
                messages,
            })
        });

        if (!response.ok) {
            let errorMsg = "AI Request failed";
            try {
                const errorData = await response.json();
                // Handle various error formats from different providers
                errorMsg = errorData?.error?.message || 
                           errorData?.message || 
                           (errorData?.error && typeof errorData.error === 'string' ? errorData.error : null) ||
                           JSON.stringify(errorData) || 
                           errorMsg;
            } catch (e) {
                try {
                    const text = await response.text();
                    if (text) errorMsg = `${errorMsg}: ${text}`;
                } catch (textErr) {}
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        
        // Normalize OpenAI-style response to Gemini-style for handleApiResponse
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const content = data.choices[0].message.content;
            
            // Try to find a base64 image in the content if it's a string
            const base64Match = typeof content === 'string' ? content.match(/data:image\/(png|jpeg|webp|avif);base64,([a-zA-Z0-9+/=]+)/) : null;
            
            if (base64Match) {
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: `image/${base64Match[1]}`,
                                    data: base64Match[2]
                                }
                            }]
                        }
                    }]
                } as any;
            }

            return {
                candidates: [{
                    content: {
                        parts: [{ text: typeof content === 'string' ? content : JSON.stringify(content) }]
                    }
                }]
            } as any;
        }
        
        return data as any;
    }
};

export const generateModelImage = async (userImage: File): Promise<string> => {
    return withRetry(async () => {
        const userImagePart = await fileToPart(userImage);
        const prompt = "You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for an e-commerce website. The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type, but place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.";
        
        const response = await universalGenerateContent({
            type: 'image',
            model: 'gemini-2.5-flash-image',
            contents: { parts: [userImagePart, { text: prompt }] },
        });
        return handleApiResponse(response);
    });
};

export const refineModelImage = async (currentImageUrl: string, instruction: string): Promise<string> => {
    return withRetry(async () => {
        const currentImagePart = dataUrlToPart(currentImageUrl);
        const prompt = `You are an expert fashion photographer AI editor. I have a fashion model image, and I need you to modify it according to these instructions: "${instruction}". 

Maintain the person's identity, the neutral studio background, and the overall professional quality. Only change what is requested. Return ONLY the final edited image.`;
        
        const response = await universalGenerateContent({
            type: 'image',
            model: 'gemini-2.5-flash-image',
            contents: { parts: [currentImagePart, { text: prompt }] },
        });
        return handleApiResponse(response);
    });
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    return withRetry(async () => {
        const modelImagePart = dataUrlToPart(modelImageUrl);
        const garmentImagePart = await fileToPart(garmentImage);
        const prompt = `You are an expert virtual try-on AI. You will be given a 'model image' and a 'garment image'. Your task is to create a new photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.

**Crucial Rules:**
1.  **Complete Garment Replacement:** You MUST completely REMOVE and REPLACE the clothing item worn by the person in the 'model image' with the new garment. No part of the original clothing (e.g., collars, sleeves, patterns) should be visible in the final image.
2.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
        
        const response = await universalGenerateContent({
            type: 'image',
            model: 'gemini-2.5-flash-image',
            contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        });
        return handleApiResponse(response);
    });
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    return withRetry(async () => {
        const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
        const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
        
        const response = await universalGenerateContent({
            type: 'image',
            model: 'gemini-2.5-flash-image',
            contents: { parts: [tryOnImagePart, { text: prompt }] },
        });
        return handleApiResponse(response);
    });
};

export const generateThemeVariation = async (imageUrl: string, themeDesc: string): Promise<string> => {
    return withRetry(async () => {
        const imagePart = dataUrlToPart(imageUrl);
        const prompt = `You are a world-class fashion photographer and high-end retouching expert. 
        
        **Task:** Take this source image of a model and seamlessly integrate them into a new environment based on this theme: "${themeDesc}".
        
        **Technical Requirements for Ultra-Realism:**
        1. **Global Illumination & Light Wrap:** The lighting from the new background MUST realistically affect the model. Apply "light wrap" where the background colors bleed slightly onto the edges of the model's hair and clothing.
        2. **Contact Shadows & Ambient Occlusion:** Create physically accurate shadows where the model's feet touch the ground. Ensure ambient occlusion in folds of clothing and where the model is near walls or objects.
        3. **Color Grading & Harmony:** Match the color temperature, saturation, and contrast of the model and their clothing to the new environment perfectly. If the theme is "Warm Cafe", the model should have a subtle warm glow.
        4. **Depth of Field:** Apply realistic lens blur (bokeh) to the background to create a sense of depth, keeping the model and their outfit in sharp, crisp focus.
        5. **Pose & Style:** If the theme description specifies a pose (e.g., "walking", "leaning", "sitting"), you MUST update the model's pose to match that description while maintaining their identity and the exact details of the clothing.
        6. **Texture Preservation:** Maintain 100% of the original texture, fabric details, and patterns of the clothing. Do NOT change the face.
        7. **Seamless Blending:** The transition between the model and the background must be invisible, with no "cut-out" look or halo effects.
        
        **Output:** Return ONLY the final, high-resolution, photorealistic image.`;
        
        const response = await universalGenerateContent({
            type: 'image',
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: '9:16'
                }
            }
        });
        return handleApiResponse(response);
    });
};

export const generateVideo = async (imageUrl: string, prompt: string, resolution: '720p' | '1080p', aspectRatio: '16:9' | '9:16', seed?: number) => {
    const { apiKey, provider, model: customModel } = getAIInstance('video');
    
    if (!apiKey) {
        throw new Error(`API Key untuk ${provider} belum diatur. Silakan buka pengaturan.`);
    }

    if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: apiKey as string });
        const { mimeType, data } = dataUrlToParts(imageUrl);
        
        const operation = await ai.models.generateVideos({
            model: (customModel as any) || 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: data,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1,
                resolution: resolution,
                aspectRatio: aspectRatio,
                seed: seed,
            }
        });
        return operation;
    } else if (provider === 'grok') {
        // Implementation for xAI Grok Imagine Video (Image to Video)
        const baseUrl = 'https://api.x.ai/v1';
        
        // Force grok-imagine-video for this endpoint as it's the only one that supports video generation
        const modelToUse = 'grok-imagine-video';
        
        const response = await fetch(`${baseUrl}/videos/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToUse,
                prompt: prompt,
                image_url: imageUrl,
                quality: resolution === '1080p' ? 'high' : 'standard',
                aspect_ratio: aspectRatio === '16:9' ? '16:9' : '9:16',
                seed: seed
            })
        });

        if (!response.ok) {
            let errorMsg = `Grok API Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                const detail = errorData?.error?.message || errorData?.message || (typeof errorData === 'object' ? JSON.stringify(errorData) : null);
                if (detail) errorMsg += ` - ${detail}`;
                
                if (response.status === 400) {
                    errorMsg = `Grok Bad Request (400): ${detail || 'Payload tidak valid'}. Pastikan menggunakan model 'grok-imagine-video' untuk output video.`;
                } else if (response.status === 401) {
                    errorMsg = "Grok API Key tidak valid. Pastikan key diawali 'xai-' dan memiliki kredit.";
                } else if (response.status === 403) {
                    errorMsg = "Akses ditolak (403). Akun Anda mungkin belum memiliki akses ke API Video (grok-imagine-video).";
                }
            } catch (e) {
                // Fallback to status text
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log('Grok Video API Response:', data);
        
        // Exhaustive search for video URL in Grok response
        let videoUrl = data.video_url || data.url;
        
        if (!videoUrl && data.data) {
            if (Array.isArray(data.data)) {
                videoUrl = data.data[0]?.url || data.data[0]?.video_url || data.data[0]?.uri;
            } else if (typeof data.data === 'object') {
                videoUrl = data.data.url || data.data.video_url || data.data.uri;
            }
        }
        
        if (!videoUrl && data.choices?.[0]?.message?.content) {
            // Sometimes models return URL in text
            videoUrl = data.choices[0].message.content.match(/https?:\/\/\S+\.(mp4|webm|mov)/i)?.[0];
        }
        
        if (!videoUrl) {
            console.error('Grok API did not return a video URL. Response body:', data);
            throw new Error('Grok API tidak mengembalikan URL video. Silakan periksa konsol untuk detailnya.');
        }

        // Return a normalized operation-like object
        return {
            done: true,
            response: {
                generatedVideos: [{
                    video: {
                        uri: videoUrl
                    }
                }]
            }
        };
    } else if (provider === 'openrouter') {
        // OpenRouter often proxies various video models
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Virtual Try-On'
            },
            body: JSON.stringify({
                model: customModel || 'google/veo-3.1-fast-generate-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: imageUrl } }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error?.message || `OpenRouter Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('OpenRouter Video API Response:', data);
        
        // Robust URL extraction from OpenRouter response
        let videoUrl = null;
        
        // 1. Try to find URL in content via regex
        const content = data.choices?.[0]?.message?.content;
        if (content) {
            const urlMatch = content.match(/https?:\/\/[^\s"']+\.(mp4|webm|mov|m4v|avi)/i);
            if (urlMatch) videoUrl = urlMatch[0];
            
            if (!videoUrl) {
                // Try any URL if no video extension found
                const anyUrlMatch = content.match(/https?:\/\/[^\s"']+/);
                if (anyUrlMatch) videoUrl = anyUrlMatch[0];
            }
        }
        
        // 2. Deep search in the entire JSON object if still not found
        if (!videoUrl) {
            const findUrl = (obj: any): string | null => {
                if (!obj || typeof obj !== 'object') return null;
                for (const key in obj) {
                    const value = obj[key];
                    if (typeof value === 'string' && value.startsWith('http') && (value.includes('.mp4') || value.includes('.webm') || value.includes('video'))) {
                        return value;
                    }
                    if (typeof value === 'object') {
                        const found = findUrl(value);
                        if (found) return found;
                    }
                }
                return null;
            };
            videoUrl = findUrl(data);
        }
        
        if (!videoUrl) {
            console.error('OpenRouter did not return a video URL. Response body:', data);
            throw new Error('OpenRouter tidak mengembalikan URL video. Silakan periksa konsol untuk detailnya.');
        }

        return {
            done: true,
            response: {
                generatedVideos: [{
                    video: {
                        uri: videoUrl
                    }
                }]
            }
        };
    }

    throw new Error(`Provider ${provider} belum didukung secara penuh untuk pembuatan video di aplikasi ini.`);
};

export const getVideosOperation = async (operation: any) => {
    const { apiKey, provider } = getAIInstance('video');
    
    if (provider !== 'gemini') {
        // For non-Gemini providers, we assume they are already done or don't use this polling mechanism
        return operation;
    }
    
    const ai = new GoogleGenAI({ apiKey: apiKey as string });
    return await ai.operations.getVideosOperation({ operation });
};
