import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";

interface Announcement {
  name: string;
  title: string;
  content: string;
  published_date: string;
}

export default function AlertCard({ announcement }: { announcement: Announcement }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-base">{announcement.title}</CardTitle>
        <Badge variant="secondary" className="shrink-0">
          {announcement.published_date}
        </Badge>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none text-muted-foreground">
        <ReactMarkdown>{announcement.content}</ReactMarkdown>
      </CardContent>
    </Card>
  );
}