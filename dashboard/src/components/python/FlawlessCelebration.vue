<template>
	<Teleport to="body">
		<div
			class="pointer-events-none fixed inset-x-0 bottom-20 z-50 md:bottom-6"
			role="status"
			aria-live="polite"
		>
			<Transition
				enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
				enter-from-class="translate-y-2 opacity-0"
				leave-active-class="transition duration-300 ease-in motion-reduce:transition-none"
				leave-to-class="opacity-0"
			>
				<div v-if="celebration" class="flex flex-col items-center gap-2">
					<div
						class="mx-4 max-w-[calc(100vw-2rem)] rounded-4 border border-outline-gray-1 bg-surface-base px-4 py-3 text-center shadow-2xl"
					>
						<Badge
							v-if="reducedMotion"
							:theme="celebration.first_try ? 'amber' : 'green'"
							:label="celebration.first_try ? 'Flawless, first try' : 'Flawless'"
						/>
						<p v-else class="font-mono text-sm text-ink-gray-5">import antigravity</p>
						<p class="mt-1 text-p-base text-ink-gray-8">{{ caption }}</p>
					</div>
					<svg
						v-if="!reducedMotion"
						class="block"
						:width="width"
						:height="TRACK_HEIGHT"
						:viewBox="`0 0 ${width} ${TRACK_HEIGHT}`"
						aria-hidden="true"
					>
						<circle
							v-for="x in track.dots"
							ref="dots"
							:key="x"
							:cx="x"
							:cy="MIDDLE"
							r="3"
							class="origin-center fill-ink-gray-4 [transform-box:fill-box]"
						/>
						<path
							ref="snake"
							:d="track.path"
							fill="none"
							stroke-width="6"
							stroke-linecap="round"
							stroke-linejoin="round"
							:stroke-dasharray="`${SNAKE_LENGTH} ${track.travel + SNAKE_LENGTH}`"
							:class="
								celebration.first_try ? 'stroke-ink-amber-5' : 'stroke-ink-green-6'
							"
						/>
					</svg>
				</div>
			</Transition>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Badge, shellScrollContainer, useCall } from 'frappe-ui'
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage'

interface Celebration {
	flawless: boolean
	first_try?: boolean
	tests?: number
}

const props = defineProps<{ assignment: string }>()

const TRACK_HEIGHT = 36
const MIDDLE = 20
const STEP = 6
const SWAY = 3
const SEGMENT = Math.hypot(STEP, SWAY)
const WAVE = ` l${STEP} ${-SWAY} l${STEP} ${SWAY} l${STEP} ${SWAY} l${STEP} ${-SWAY}`
const TICK = ' l12 10 l24 -24'
const TICK_WIDTH = 36
const SNAKE_LENGTH = Math.hypot(12, 10) + Math.hypot(24, 24)
const GUTTER = 16
const FLOAT_MS = 1400
const CRAWL_DELAY_MS = 300
const CRAWL_MS = 2400
const ENDS_AFTER_MS = 4000

const celebrationCall = useCall<Celebration, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.celebration.get_celebration',
	params: () => ({ assignment: props.assignment }),
	refetch: true,
})

const celebration = ref<Celebration | null>(null)
const reducedMotion = ref(false)
const width = ref(0)
const snake = useTemplateRef<SVGPathElement>('snake')
const dots = useTemplateRef<SVGCircleElement[]>('dots')

const caption = computed(() =>
	reducedMotion.value
		? 'Every test, even the hidden ones.'
		: `Flawless. Every test, even the hidden ones.${celebration.value?.first_try ? ' First try.' : ''}`,
)

const track = computed(() => {
	const tickStart = width.value - GUTTER - TICK_WIDTH
	const waves = Math.ceil((tickStart + SNAKE_LENGTH) / (4 * STEP))
	const start = tickStart - waves * 4 * STEP
	const tests = celebration.value?.tests ?? 0
	const spacing = (tickStart - GUTTER) / tests
	return {
		start,
		travel: waves * 4 * SEGMENT,
		path: `M${start} ${MIDDLE}${WAVE.repeat(waves)}${TICK}`,
		dots: Array.from({ length: tests }, (_, index) => GUTTER + (index + 0.5) * spacing),
	}
})

function eatenAt(x: number): number {
	const { start, travel } = track.value
	const reached = ((x - start) / STEP) * SEGMENT - SNAKE_LENGTH
	return CRAWL_DELAY_MS + (CRAWL_MS * reached) / travel
}

let timer: ReturnType<typeof setTimeout> | undefined

watch(
	() => celebrationCall.data,
	async (data) => {
		const key = STORAGE_KEYS.celebratedAssignment(props.assignment)
		if (!data?.flawless || readJSON(key, false)) return
		writeJSON(key, true)
		reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		width.value = document.documentElement.clientWidth
		celebration.value = data
		timer = setTimeout(dismiss, ENDS_AFTER_MS)
		window.addEventListener('click', dismiss, true)
		window.addEventListener('keydown', dismissOnEscape)
		if (reducedMotion.value) return

		shellScrollContainer.value?.animate(
			[
				{ transform: 'none' },
				{ transform: 'translateY(-6px)', offset: 0.4 },
				{ transform: 'none' },
			],
			{ duration: FLOAT_MS, easing: 'ease-in-out' },
		)
		await nextTick()
		snake.value?.animate(
			[{ strokeDashoffset: '0px' }, { strokeDashoffset: `${-track.value.travel}px` }],
			{ delay: CRAWL_DELAY_MS, duration: CRAWL_MS, fill: 'both' },
		)
		for (const dot of dots.value ?? [])
			dot.animate(
				[
					{ opacity: 1, transform: 'scale(1)' },
					{ opacity: 0, transform: 'scale(0)' },
				],
				{ delay: eatenAt(dot.cx.baseVal.value), duration: 150, fill: 'both' },
			)
	},
)

function dismiss() {
	celebration.value = null
	clearTimeout(timer)
	window.removeEventListener('click', dismiss, true)
	window.removeEventListener('keydown', dismissOnEscape)
}

function dismissOnEscape(event: KeyboardEvent) {
	if (event.key === 'Escape') dismiss()
}

onBeforeUnmount(dismiss)
</script>
