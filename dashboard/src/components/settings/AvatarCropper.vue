<template>
	<div class="space-y-4">
		<div
			ref="frame"
			:class="frameClass"
			@pointerdown="startDrag"
			@wheel.prevent="zoomWithWheel"
		>
			<div
				v-if="imageUrl && imageSize"
				class="absolute left-1/2 top-1/2 will-change-transform"
				:style="imageWrapStyle"
			>
				<img
					ref="image"
					:src="imageUrl"
					alt=""
					class="max-w-none select-none"
					draggable="false"
					:style="imageStyle"
				/>
			</div>
			<!-- Drawn over the photo, so it stays white on a dark scrim in both themes. -->
			<div
				class="pointer-events-none absolute inset-[7%] rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.28)]"
			/>
			<Button
				class="absolute right-3 top-3"
				icon="lucide-rotate-cw"
				aria-label="Rotate"
				tooltip="Rotate"
				@pointerdown.stop
				@click.stop="rotate"
			/>
		</div>

		<div class="flex items-center gap-3">
			<Button
				variant="ghost"
				icon="lucide-minus"
				aria-label="Zoom out"
				tooltip="Zoom out"
				@click="nudgeZoom(-10)"
			/>
			<Slider
				v-model="zoomValue"
				class="min-w-0 flex-1"
				aria-label="Zoom"
				:min="MIN_ZOOM"
				:max="MAX_ZOOM"
				:step="1"
			/>
			<Button
				variant="ghost"
				icon="lucide-plus"
				aria-label="Zoom in"
				tooltip="Zoom in"
				@click="nudgeZoom(10)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Button, Slider } from 'frappe-ui'

const OUTPUT_SIZE = 512
const MIN_ZOOM = 100
const MAX_ZOOM = 300

interface Point {
	x: number
	y: number
}

interface Size {
	width: number
	height: number
}

const props = defineProps<{ file: File }>()

const frame = useTemplateRef<HTMLElement>('frame')
const image = useTemplateRef<HTMLImageElement>('image')
const imageUrl = ref('')
const imageSize = ref<Size | null>(null)
const offset = ref<Point>({ x: 0, y: 0 })
const rotation = ref(0)
const zoomValue = ref([MIN_ZOOM])
const dragState = ref<{ pointerId: number; start: Point; offset: Point } | null>(null)

const zoom = computed(() => zoomValue.value[0] / 100)
const frameSize = computed(() => frame.value?.clientWidth || 0)
const rotatedSize = computed(() => {
	if (!imageSize.value) return null
	if (rotation.value % 180 === 0) return imageSize.value
	return { width: imageSize.value.height, height: imageSize.value.width }
})
const baseScale = computed(() => {
	if (!rotatedSize.value || !frameSize.value) return 1
	return Math.max(
		frameSize.value / rotatedSize.value.width,
		frameSize.value / rotatedSize.value.height,
	)
})
const renderedSize = computed(() => {
	if (!rotatedSize.value) return null
	const scale = baseScale.value * zoom.value
	return {
		width: rotatedSize.value.width * scale,
		height: rotatedSize.value.height * scale,
	}
})
const frameClass = computed(() => [
	'relative aspect-square w-full touch-none select-none overflow-hidden rounded-6 bg-surface-gray-2',
	dragState.value ? 'cursor-grabbing' : 'cursor-grab',
])
const imageWrapStyle = computed(() => ({
	transform: `translate(-50%, -50%) translate(${offset.value.x}px, ${offset.value.y}px)`,
}))
const imageStyle = computed(() => {
	if (!imageSize.value) return {}
	return {
		width: `${imageSize.value.width * baseScale.value}px`,
		height: `${imageSize.value.height * baseScale.value}px`,
		transform: `rotate(${rotation.value}deg) scale(${zoom.value})`,
	}
})

watch(
	() => props.file,
	async (file) => {
		clearImageUrl()
		imageUrl.value = URL.createObjectURL(file)
		imageSize.value = await loadImageSize(imageUrl.value).catch(() => null)
		resetCrop()
		await nextTick()
		constrainOffset()
	},
	{ immediate: true },
)

watch([zoomValue, rotation], constrainOffset)

onBeforeUnmount(clearImageUrl)

function resetCrop() {
	offset.value = { x: 0, y: 0 }
	rotation.value = 0
	zoomValue.value = [MIN_ZOOM]
}

function rotate() {
	rotation.value = (rotation.value + 90) % 360
}

function nudgeZoom(delta: number) {
	zoomValue.value = [clamp(zoomValue.value[0] + delta, MIN_ZOOM, MAX_ZOOM)]
}

function zoomWithWheel(event: WheelEvent) {
	nudgeZoom(event.deltaY > 0 ? -8 : 8)
}

function startDrag(event: PointerEvent) {
	if (!frame.value) return
	frame.value.setPointerCapture(event.pointerId)
	dragState.value = {
		pointerId: event.pointerId,
		start: { x: event.clientX, y: event.clientY },
		offset: { ...offset.value },
	}
	window.addEventListener('pointermove', drag)
	window.addEventListener('pointerup', stopDrag)
}

function drag(event: PointerEvent) {
	if (!dragState.value) return
	offset.value = constrainPoint({
		x: dragState.value.offset.x + event.clientX - dragState.value.start.x,
		y: dragState.value.offset.y + event.clientY - dragState.value.start.y,
	})
}

function stopDrag(event: PointerEvent) {
	if (dragState.value?.pointerId === event.pointerId) dragState.value = null
	window.removeEventListener('pointermove', drag)
	window.removeEventListener('pointerup', stopDrag)
}

function constrainOffset() {
	offset.value = constrainPoint(offset.value)
}

function constrainPoint(point: Point): Point {
	if (!renderedSize.value || !frameSize.value) return point
	const maxX = Math.max(0, (renderedSize.value.width - frameSize.value) / 2)
	const maxY = Math.max(0, (renderedSize.value.height - frameSize.value) / 2)
	return {
		x: clamp(point.x, -maxX, maxX),
		y: clamp(point.y, -maxY, maxY),
	}
}

async function getCroppedBlob(): Promise<Blob | null> {
	if (!image.value || !imageSize.value || !frameSize.value) return null

	const canvas = document.createElement('canvas')
	canvas.width = OUTPUT_SIZE
	canvas.height = OUTPUT_SIZE
	const context = canvas.getContext('2d')
	if (!context) return null

	context.fillStyle = 'white'
	context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

	const outputRatio = OUTPUT_SIZE / frameSize.value
	const scale = baseScale.value * zoom.value * outputRatio
	context.translate(
		OUTPUT_SIZE / 2 + offset.value.x * outputRatio,
		OUTPUT_SIZE / 2 + offset.value.y * outputRatio,
	)
	context.rotate((rotation.value * Math.PI) / 180)
	context.scale(scale, scale)
	context.drawImage(image.value, -imageSize.value.width / 2, -imageSize.value.height / 2)

	return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

function clearImageUrl() {
	if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
	imageUrl.value = ''
}

function loadImageSize(url: string): Promise<Size> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
		img.onerror = reject
		img.src = url
	})
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value))
}

defineExpose({ getCroppedBlob, resetCrop })
</script>
