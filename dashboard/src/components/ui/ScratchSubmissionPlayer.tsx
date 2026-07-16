import { useCallback, useEffect, useRef } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Skeleton } from "@/components/ui/skeleton";
import {
	SCRATCH_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	base64ToArrayBuffer,
} from "@/lib/scratch";

// Strips the editor down to a review view: only the code (blocks canvas) and
// the stage where the project runs stay visible. Everything else is hidden —
// menu bar, Code/Backdrops/Sounds tabs, Find bar, the sprite/stage panel (which
// is also how sprites/costumes get deleted), Backpack, the extension button,
// zoom, and scrollbars. Blocks are locked (no drag/edit) but the green flag,
// stop, and stage stay live so the project runs. Selectors use Blockly's stable
// global classes, scratch-gui's readable module prefixes (only the trailing hash
// varies per build), and the TurboWarp addon's stable `sa-find-bar` class.
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

// Loads a submitted .sb3 snapshot into the full Scratch editor so faculty see
// the student's blocks/code, not just the stage. The snapshot bytes come from
// the faculty-gated get_submission_project API, never a raw file download.
export default function ScratchSubmissionPlayer({ submission }: { submission: string }) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const readyRef = useRef(false);
	const loadedRef = useRef(false);

	const { data, isLoading, error } = useFrappeGetCall<{ message: { content: string } }>(
		"cs17_portal.api.get_submission_project",
		{ submission },
		`grading-project-${submission}`,
	);
	const sb3Content = data?.message?.content ?? null;

	const loadIntoPlayer = useCallback(() => {
		if (loadedRef.current || !readyRef.current || !sb3Content) return;
		if (!iframeRef.current?.contentWindow) return;
		const sb3 = base64ToArrayBuffer(sb3Content);
		loadedRef.current = true;
		iframeRef.current.contentWindow.postMessage(
			{ type: SCRATCH_MESSAGE.loadProject, sb3 },
			SCRATCH_TARGET_ORIGIN,
			[sb3],
		);
	}, [sb3Content]);

	useEffect(() => {
		loadIntoPlayer();
	}, [loadIntoPlayer]);

	const applyReadOnly = useCallback(() => {
		const doc = iframeRef.current?.contentDocument;
		if (!doc || doc.getElementById("cs17-readonly-style")) return;
		const style = doc.createElement("style");
		style.id = "cs17-readonly-style";
		style.textContent = READONLY_CSS;
		doc.head.appendChild(style);
		// Block the workspace right-click menu (delete / clean up blocks).
		doc.addEventListener("contextmenu", (event) => event.preventDefault(), true);
	}, []);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (event.data?.type === SCRATCH_MESSAGE.ready) {
				readyRef.current = true;
				loadIntoPlayer();
				applyReadOnly();
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [loadIntoPlayer, applyReadOnly]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
				Could not load the submitted project.
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			{isLoading && <Skeleton className="absolute inset-0" />}
			<iframe
				ref={iframeRef}
				src={SCRATCH_EDITOR_URL}
				title="Scratch submission player"
				onLoad={applyReadOnly}
				className="h-full w-full border-0"
			/>
		</div>
	);
}
