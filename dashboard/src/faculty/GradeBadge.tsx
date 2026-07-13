import { Badge } from "@/components/ui/badge";
import type { CohortSubmission } from "./types";

export function GradeBadge({ submission }: { submission: CohortSubmission }) {
	if (!submission.graded) {
		return <Badge variant="secondary">Pending</Badge>;
	}
	return (
		<Badge variant="default">
			{submission.marks_obtained != null
				? `${submission.marks_obtained} / ${submission.max_marks}`
				: (submission.grade ?? "Graded")}
		</Badge>
	);
}
