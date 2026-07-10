export const SCRATCH_EDITOR_URL = "/assets/cs17_portal/scratch/editor.html";

export const SCRATCH_READONLY_EDITOR_URL = `${SCRATCH_EDITOR_URL}?readonly=1`;

export const SCRATCH_TARGET_ORIGIN = "*";

export const SCRATCH_MESSAGE = {
	loadProject: "load-project",
	requestSb3: "request-sb3",
	projectSb3: "project-sb3",
	ready: "ready",
	dirty: "dirty",
} as const;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

export function dataUrlToBase64(dataUrl: string): string {
	return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}
