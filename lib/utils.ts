
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    let rawMessage = 'Terjadi kesalahan yang tidak diketahui.';
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    if (rawMessage.includes("Unsupported MIME type")) {
        try {
            const errorJson = JSON.parse(rawMessage);
            const nestedMessage = errorJson?.error?.message;
            if (nestedMessage && nestedMessage.includes("Unsupported MIME type")) {
                const mimeType = nestedMessage.split(': ')[1] || 'tidak didukung';
                return `Format file '${mimeType}' tidak didukung. Silakan gunakan format seperti PNG, JPEG, atau WEBP.`;
            }
        } catch (e) {}
        return `Format file tidak didukung. Silakan unggah format gambar seperti PNG, JPEG, atau WEBP.`;
    }
    
    return `${context}. ${rawMessage}`;
}
