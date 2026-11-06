export function unescapeTags(markdown: string): string {
	return markdown.replace(/&lt;(?=\/?[a-zA-Z])/g, '<')
}

export interface MarkdownPart {
	title: string | null
	body: string
}

/** Markdown cut at its `## ` headings; a heading inside a code block stays where it is. */
export function splitAtHeadings(markdown: string): MarkdownPart[] {
	const parts: MarkdownPart[] = [{ title: null, body: '' }]
	let inCodeBlock = false
	for (const line of markdown.split('\n')) {
		if (/^\s*(```|~~~)/.test(line)) inCodeBlock = !inCodeBlock
		const heading = inCodeBlock ? null : /^## +(.+)$/.exec(line)
		if (heading) parts.push({ title: heading[1].trim(), body: '' })
		else parts[parts.length - 1].body += `${line}\n`
	}
	return parts
		.map((part) => ({ ...part, body: part.body.trim() }))
		.filter((part) => part.title || part.body)
}
