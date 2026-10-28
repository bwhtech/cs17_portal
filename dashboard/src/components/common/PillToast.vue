<template>
	<div :style="{ '--toast-spring': SPRING_EASING }">
		<div
			ref="root"
			class="relative transition-[height] duration-[600ms] ease-[--toast-spring] motion-reduce:transition-none"
			:style="{ height: `${open ? expandedHeight : HEIGHT}px` }"
		>
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0"
				aria-hidden="true"
			>
				<svg
					class="block -scale-y-100 overflow-visible"
					:width="width"
					:height="expandedHeight"
					:viewBox="`0 0 ${width} ${expandedHeight}`"
				>
					<defs>
						<filter
							:id="filterId"
							filterUnits="userSpaceOnUse"
							:x="-BLUR * 2"
							:y="-BLUR * 2"
							:width="width + BLUR * 4"
							:height="expandedHeight + BLUR * 4"
							color-interpolation-filters="sRGB"
						>
							<feGaussianBlur in="SourceGraphic" :stdDeviation="BLUR" result="blur" />
							<feColorMatrix
								in="blur"
								type="matrix"
								values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
								result="goo"
							/>
							<feComposite in="SourceGraphic" in2="goo" operator="atop" />
						</filter>
					</defs>
					<g :filter="`url(#${filterId})`" class="fill-surface-gray-10">
						<rect
							:x="pillX"
							:width="pillWidth"
							:height="HEIGHT + progress * BLUR * 3"
							:rx="ROUNDNESS"
							:ry="ROUNDNESS"
						/>
						<rect
							:y="HEIGHT"
							:width="width"
							:height="Math.max(progress, 0) * (expandedHeight - HEIGHT)"
							:opacity="Math.min(Math.max(progress, 0), 1)"
							:rx="ROUNDNESS"
							:ry="ROUNDNESS"
						/>
					</g>
				</svg>
			</div>

			<div
				class="absolute bottom-0 z-20 flex h-10 items-center overflow-hidden p-2"
				:style="{ left: `${pillX}px`, maxWidth: `${pillWidth}px` }"
			>
				<Transition
					appear
					enter-from-class="opacity-0 blur-[6px]"
					enter-active-class="transition duration-[600ms] ease-[--toast-spring]"
				>
					<div ref="header" class="flex items-center gap-2 whitespace-nowrap">
						<span
							class="grid size-6 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_oklch,currentColor_20%,transparent)]"
							:class="look.content"
							aria-hidden="true"
						>
							<span class="size-4" :class="look.icon" />
						</span>
						<span class="text-base font-medium" :class="look.content">
							<span v-if="look.label" class="sr-only">{{ look.label }},</span>
							{{ toast.message }}
						</span>
					</div>
				</Transition>
			</div>

			<div
				v-if="hasBody"
				class="absolute inset-x-0 top-0 z-10 transition-opacity ease-[ease]"
				:class="
					open
						? 'opacity-100 delay-[180ms] duration-[360ms]'
						: 'pointer-events-none opacity-0 delay-[24ms] duration-[48ms]'
				"
			>
				<div ref="content" class="flex items-center gap-3 p-4">
					<p
						v-if="toast.description"
						class="line-clamp-2 min-w-0 flex-1 text-p-base text-ink-base opacity-60"
					>
						{{ toast.description }}
					</p>
					<button
						v-if="toast.action"
						type="button"
						class="ml-auto h-7 shrink-0 rounded-full bg-[color:color-mix(in_oklch,currentColor_15%,transparent)] px-2.5 text-sm font-medium transition-colors hover:bg-[color:color-mix(in_oklch,currentColor_25%,transparent)]"
						:class="look.content"
						@click="emit('action')"
					>
						{{ toast.action.label }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Toast, ToastKind } from '@/lib/toast'

const props = defineProps<{ toast: Toast; expanded: boolean }>()

const emit = defineEmits<{ action: [] }>()

const HEIGHT = 40
const ROUNDNESS = 16
const BLUR = ROUNDNESS / 2
const PILL_PADDING = 10
const MIN_EXPANDED_HEIGHT = HEIGHT * 2.25
const OPEN = { stiffness: 244, dampingRatio: 0.75 }
const CLOSE = { stiffness: 237, dampingRatio: 1 }
const SPRING_EASING =
	'linear(0, 0.002 0.6%, 0.007 1.2%, 0.015 1.8%, 0.026 2.4%, 0.041 3.1%, 0.06 3.8%, 0.108 5.3%, 0.157 6.6%, 0.214 8%, 0.467 13.7%, 0.577 16.3%, 0.631 17.7%, 0.682 19.1%, 0.73 20.5%, 0.771 21.8%, 0.808 23.1%, 0.844 24.5%, 0.874 25.8%, 0.903 27.2%, 0.928 28.6%, 0.952 30.1%, 0.972 31.6%, 0.988 33.1%, 1.01 35.7%, 1.025 38.5%, 1.034 41.6%, 1.038 45%, 1.035 50.1%, 1.012 64.2%, 1.003 73%, 0.999 83.7%, 1)'

const LOOKS: Record<ToastKind, { content: string; icon: string; label: string }> = {
	success: { content: 'text-ink-green-5', icon: 'lucide-check', label: 'Success' },
	error: { content: 'text-ink-red-5', icon: 'lucide-x', label: 'Error' },
	warning: { content: 'text-ink-amber-5', icon: 'lucide-triangle-alert', label: 'Warning' },
	info: { content: 'text-ink-blue-5', icon: 'lucide-info', label: '' },
}

const look = computed(() => LOOKS[props.toast.kind])
const hasBody = computed(() => Boolean(props.toast.description || props.toast.action))
const open = computed(() => props.expanded && hasBody.value)
const filterId = computed(() => `toast-goo-${props.toast.id}`)

const root = ref<HTMLElement | null>(null)
const header = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const width = ref(0)
const headerWidth = ref(0)
const contentHeight = ref(0)
const progress = ref(0)

const resizeObserver = new ResizeObserver(() => {
	width.value = root.value?.offsetWidth ?? 0
	headerWidth.value = header.value?.scrollWidth ?? 0
	contentHeight.value = content.value?.offsetHeight ?? 0
})

onMounted(() => {
	for (const el of [root.value, header.value, content.value]) if (el) resizeObserver.observe(el)
})

const pillWidth = computed(() =>
	Math.min(Math.max(headerWidth.value + 16 + PILL_PADDING, HEIGHT), width.value || Infinity),
)
const pillX = computed(() => (width.value - pillWidth.value) / 2)
const expandedHeight = computed(() =>
	hasBody.value ? Math.max(MIN_EXPANDED_HEIGHT, HEIGHT + contentHeight.value) : HEIGHT,
)

let frame = 0
let velocity = 0

function springTo(target: number, spring: { stiffness: number; dampingRatio: number }) {
	cancelAnimationFrame(frame)
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		progress.value = target
		return
	}
	const damping = 2 * spring.dampingRatio * Math.sqrt(spring.stiffness)
	let last = performance.now()
	const step = (now: number) => {
		const dt = Math.min((now - last) / 1000, 1 / 30) / 4
		last = now
		for (let i = 0; i < 4; i++) {
			velocity += (-spring.stiffness * (progress.value - target) - damping * velocity) * dt
			progress.value += velocity * dt
		}
		if (Math.abs(progress.value - target) < 0.001 && Math.abs(velocity) < 0.01) {
			progress.value = target
			velocity = 0
			return
		}
		frame = requestAnimationFrame(step)
	}
	frame = requestAnimationFrame(step)
}

watch(open, (value) => springTo(value ? 1 : 0, value ? OPEN : CLOSE))

onBeforeUnmount(() => {
	cancelAnimationFrame(frame)
	resizeObserver.disconnect()
})
</script>
