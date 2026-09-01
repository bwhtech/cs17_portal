export interface SubmissionTypeConfig {
	label: string
	help: string
	error: string
	accept?: string
	extensions: string[]
}

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

const SUBMISSION_TYPE_CONFIG: Record<string, SubmissionTypeConfig> = {
	PDF: {
		label: 'Upload a PDF only',
		help: 'Only .pdf files are accepted.',
		error: 'Please upload a PDF file only.',
		accept: 'application/pdf',
		extensions: ['.pdf'],
	},
	Image: {
		label: 'Upload an image only',
		help: 'Accepted: PNG, JPG, JPEG, GIF, WEBP.',
		error: 'Please upload an image only (PNG, JPG, GIF, or WEBP).',
		accept: 'image/*',
		extensions: IMAGE_EXTENSIONS,
	},
	ZIP: {
		label: 'Upload a ZIP archive only',
		help: 'Accepted: .zip, .tar.gz, .tgz.',
		error: 'Please upload a ZIP archive only (.zip, .tar.gz, or .tgz).',
		accept: '.zip,.tar.gz,.tgz',
		extensions: ['.zip', '.tar.gz', '.tgz'],
	},
	URL: {
		label: 'Paste a URL only',
		help: 'Enter a link starting with http:// or https://.',
		error: 'Please paste a valid URL starting with http:// or https://.',
		extensions: [],
	},
	Any: {
		label: 'Upload your file',
		help: 'Any file type is accepted.',
		error: 'Please choose a file to submit.',
		extensions: [],
	},
}

export function getSubmissionConfig(submissionType?: string): SubmissionTypeConfig {
	return SUBMISSION_TYPE_CONFIG[submissionType ?? 'Any'] ?? SUBMISSION_TYPE_CONFIG.Any
}

export function isValidUrl(value: string): boolean {
	try {
		const parsed = new URL(value.trim())
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}

export function isSubmissionValid(submissionType: string, file: File | null, url: string): boolean {
	if (submissionType === 'URL') return isValidUrl(url)
	const config = getSubmissionConfig(submissionType)
	if (!file) return false
	if (config.extensions.length === 0) return true
	const name = file.name.toLowerCase()
	return config.extensions.some((ext) => name.endsWith(ext))
}

export type PreviewKind = 'image' | 'pdf' | 'url' | 'file'

export function previewKind(
	submissionType: string | undefined,
	fileUrl: string | null | undefined,
): PreviewKind {
	if (!fileUrl) return 'file'
	const lower = fileUrl.toLowerCase()
	if (submissionType === 'URL') return 'url'
	if (submissionType === 'Image' || IMAGE_EXTENSIONS.some((e) => lower.endsWith(e))) {
		return 'image'
	}
	if (submissionType === 'PDF' || lower.endsWith('.pdf')) return 'pdf'
	// A stored upload lives under /files/; treat any other link as a URL.
	if (/^https?:\/\//.test(lower) && !lower.includes('/files/')) return 'url'
	return 'file'
}
