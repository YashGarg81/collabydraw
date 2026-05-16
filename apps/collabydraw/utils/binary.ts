/**
 * Phase 4: Binary/Encrypted Data Helpers
 */

export function uint8ArrayToBase64(arr: Uint8Array): string {
    try {
        let binary = '';
        const len = arr.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(arr[i]);
        }
        return window.btoa(binary);
    } catch (e) {
        console.error("Failed to encode to base64:", e);
        return "";
    }
}

export function base64ToUint8Array(base64: string): Uint8Array {
    if (!base64 || typeof base64 !== 'string') {
        return new Uint8Array(0);
    }
    
    try {
        // Remove whitespace and potential data URI prefix if present
        const cleanBase64 = base64.trim().replace(/^data:.*?;base64,/, "");
        const binaryString = window.atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Failed to decode base64 string:", e);
        return new Uint8Array(0);
    }
}
