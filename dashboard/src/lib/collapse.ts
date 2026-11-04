export function growToContent(el: Element) {
	const body = el as HTMLElement
	body.style.height = '0'
	void body.offsetHeight
	body.style.height = `${body.scrollHeight}px`
}

export function shrinkToZero(el: Element) {
	const body = el as HTMLElement
	body.style.height = `${body.scrollHeight}px`
	void body.offsetHeight
	body.style.height = '0'
}

export function releaseHeight(el: Element) {
	;(el as HTMLElement).style.height = ''
}
