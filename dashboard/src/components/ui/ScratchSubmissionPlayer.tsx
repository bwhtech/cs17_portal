import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Skeleton } from "@/components/ui/skeleton";
import {
	SCRATCH_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	applyScratchDefaults,
	applyScratchReadOnly,
	base64ToArrayBuffer,
} from "@/lib/scratch";

export default function ScratchSubmissionPlayer({ submission }: { submission: string }) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const readyRef = useRef(false);
	const loadedRef = useRef(false);
	useLayoutEffect(() => applyScratchDefaults(), []);

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
		applyScratchReadOnly(iframeRef.current);
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
