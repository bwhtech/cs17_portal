<template>
	<Teleport to="body">
		<div
			class="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
			:style="{ width: `${width}px`, transform: translate }"
			aria-hidden="true"
		>
			<div
				v-for="(layer, index) in layers"
				:key="index"
				class="absolute inset-0 rounded-4 border border-outline-gray-2 bg-surface-elevation-1 shadow-lg"
				:style="{ transform: layer }"
			/>

			<div class="relative rotate-3 drop-shadow-xl">
				<div
					class="rounded-4 border border-outline-gray-1 bg-surface-elevation-1 p-3 shadow-2xl"
				>
					<slot />
				</div>
				<Badge
					v-if="count > 1"
					class="absolute -right-2 -top-2"
					variant="solid"
					theme="gray"
					:label="String(count)"
				/>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Badge } from 'frappe-ui'

const props = defineProps<{
	count: number
	start: { x: number; y: number }
	offset: { x: number; y: number }
	width: number
}>()

const MAX_LAYERS = 3

const point = ref(props.start)

function follow(event: PointerEvent) {
	point.value = { x: event.clientX, y: event.clientY }
}

onMounted(() => window.addEventListener('pointermove', follow))
onBeforeUnmount(() => window.removeEventListener('pointermove', follow))

const translate = computed(
	() =>
		`translate3d(${point.value.x - props.offset.x}px, ${point.value.y - props.offset.y}px, 0)`,
)

const layers = computed(() =>
	Array.from({ length: Math.min(props.count - 1, MAX_LAYERS) }, (_, index) => {
		const depth = index + 1
		return `translate(${depth * -4}px, ${depth * 4}px) rotate(${depth * -3}deg)`
	}).reverse(),
)
</script>
