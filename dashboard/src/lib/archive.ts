import type { TreeNode } from 'frappe-ui'

export interface ArchiveEntry {
	path: string
	size: number
	is_dir: boolean
	preview: 'text' | 'image' | null
	content: string | null
}

export interface ArchiveNode extends TreeNode {
	path: string
	label: string
	children: ArchiveNode[]
	entry: ArchiveEntry | null
}

export function buildArchiveTree(entries: ArchiveEntry[]): ArchiveNode[] {
	const roots: ArchiveNode[] = []
	const byPath = new Map<string, ArchiveNode>()

	for (const entry of entries) {
		let siblings = roots
		let path = ''
		const names = entry.path.split('/').filter(Boolean)
		names.forEach((name, index) => {
			path = path ? `${path}/${name}` : name
			let node = byPath.get(path)
			if (!node) {
				node = { path, label: name, children: [], entry: null }
				byPath.set(path, node)
				siblings.push(node)
			}
			if (index === names.length - 1) node.entry = entry
			siblings = node.children
		})
	}

	sortNodes(roots)
	return roots
}

export function isFolder(node: ArchiveNode): boolean {
	return !node.entry || node.entry.is_dir
}

export function firstFile(nodes: ArchiveNode[]): ArchiveNode | null {
	for (const node of nodes) {
		const file = isFolder(node) ? firstFile(node.children) : node
		if (file) return file
	}
	return null
}

export function folderPaths(nodes: ArchiveNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children.length ? [node.path, ...folderPaths(node.children)] : [],
	)
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sortNodes(nodes: ArchiveNode[]) {
	nodes.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.label.localeCompare(b.label))
	nodes.forEach((node) => sortNodes(node.children))
}
