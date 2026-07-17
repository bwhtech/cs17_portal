import { useEffect, useState } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { frappeErrorMessage } from "@/lib/frappeError";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: { name: string; project_title: string } | null;
	onSuccess: () => void;
}

export default function DeleteProjectDialog({
	open,
	onOpenChange,
	project,
	onSuccess,
}: Props) {
	const [error, setError] = useState<string | null>(null);
	const { call, loading } = useFrappePostCall("cs17_portal.api.delete_project");

	useEffect(() => {
		setError(null);
	}, [project]);

	async function handleDelete(event: React.MouseEvent) {
		event.preventDefault();
		setError(null);
		try {
			await call({ project: project!.name });
			onSuccess();
		} catch (err) {
			setError(frappeErrorMessage(err, "Could not delete the project."));
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete "{project?.project_title}"?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes the project and its saved blocks. This cannot be
						undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={loading}
						className="bg-destructive/10 text-destructive hover:bg-destructive/20"
					>
						{loading ? "Deleting…" : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
