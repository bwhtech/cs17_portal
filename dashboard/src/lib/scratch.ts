// Helpers for the embedded Scratch editor: the iframe URL, the postMessage
// protocol names (spec section 3), and the ArrayBuffer <-> base64 conversions
// the host does before calling save_project.

export const SCRATCH_EDITOR_URL = "/assets/cs17_portal/scratch/editor.html";

// Read-only player for the faculty grading view: same bundle, palette/editing hidden,
// only green-flag/run allowed (spec section 3).
export const SCRATCH_READONLY_EDITOR_URL = `${SCRATCH_EDITOR_URL}?readonly=1`;

// Origin for postMessage into the iframe. The vendored bridge posts back with '*'
// for local dev; the host mirrors that here.
// ponytail: wildcard target origin, pin to the portal origin before prod (matches the bridge note)
export const SCRATCH_TARGET_ORIGIN = "*";

export const SCRATCH_MESSAGE = {
	loadProject: "load-project",
	requestSb3: "request-sb3",
	projectSb3: "project-sb3",
	ready: "ready",
	dirty: "dirty",
} as const;

// The Scratch VM hands back an ArrayBuffer; save_project wants base64 of those bytes.
// Chunked so a multi-MB .sb3 never overflows the String.fromCharCode call stack.
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

// The bridge sends the thumbnail as a PNG data URL; save_project wants the bare base64.
export function dataUrlToBase64(dataUrl: string): string {
	return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

// get_submission_project returns the .sb3 as base64; the read-only player wants the raw
// ArrayBuffer to postMessage into the editor (inverse of arrayBufferToBase64).
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}
