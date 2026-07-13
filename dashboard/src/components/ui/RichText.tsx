import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface Props {
  content?: string | null;
  fallback?: string;
  className?: string;
}

export default function RichText({
  content,
  fallback = "No description provided.",
  className = "prose prose-sm max-w-none",
}: Props) {
  if (!content?.trim()) {
    return <p className="text-muted-foreground">{fallback}</p>;
  }
  return (
    <div className={className}>
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
    </div>
  );
}
