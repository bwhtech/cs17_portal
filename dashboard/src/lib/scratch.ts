export const SCRATCH_EDITOR_URL = "/assets/cs17_portal/scratch/editor.html";

export const SCRATCH_TARGET_ORIGIN = "*";

export const SCRATCH_MESSAGE = {
	loadProject: "load-project",
	requestSb3: "request-sb3",
	projectSb3: "project-sb3",
	ready: "ready",
	dirty: "dirty",
} as const;

const READONLY_CSS = `
	.blocklyToolboxDiv, .blocklyFlyout, .blocklyFlyoutButton,
	.blocklyZoom, .blocklyScrollbarVertical, .blocklyScrollbarHorizontal,
	[class*="menu-bar_menu-bar_"],
	[class*="gui_tab-list_"],
	[class*="target-pane_target-pane_"],
	[class*="backpack_backpack-container_"],
	[class*="extension-button-container_"],
	.sa-find-bar { display: none !important; }
	.blocklyBlockCanvas { pointer-events: none !important; }
`;

// The editor shares this app's origin, so it reads these localStorage keys on boot.
// Seed them before the iframe loads: light theme by default (TurboWarp otherwise
// follows the OS and shows dark), and the pause button addon off.
export function applyScratchDefaults(): void {
	try {
		if (!localStorage.getItem("tw:theme")) {
			localStorage.setItem("tw:theme", "light");
		}
		const addons = parseAddonSettings(localStorage.getItem("tw:addons"));
		addons.pause = { ...addons.pause, enabled: false };
		localStorage.setItem("tw:addons", JSON.stringify(addons));
	} catch {
		// No localStorage — the editor falls back to its own defaults.
	}
}

function parseAddonSettings(raw: string | null): Record<string, { enabled?: boolean }> {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export function applyScratchReadOnly(iframe: HTMLIFrameElement | null): void {
	const doc = iframe?.contentDocument;
	if (!doc || doc.getElementById("cs17-readonly-style")) return;
	const style = doc.createElement("style");
	style.id = "cs17-readonly-style";
	style.textContent = READONLY_CSS;
	doc.head.appendChild(style);
	doc.addEventListener("contextmenu", (event) => event.preventDefault(), true);
}

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
