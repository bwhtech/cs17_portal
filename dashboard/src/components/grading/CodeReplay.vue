<template>
	<p v-if="isRefusal(replay.error)" class="text-p-base text-ink-gray-5">
		{{ frappeErrorMessage(replay.error, 'Could not load the replay.') }}
	</p>

	<LoadError
		v-else-if="failed"
		title="Could not load the replay"
		:loading="replay.loading"
		@retry="replay.reload()"
	/>

	<div v-else-if="!replay.data" class="cs17-delay-in">
		<Skeleton class="h-[50vh] min-h-64 w-full" />
	</div>

	<EmptyState
		v-else-if="!snapshot"
		icon="lucide-history"
		title="Nothing to replay"
		description="No saves were recorded for this code."
	/>

	<div v-else class="space-y-3">
		<div class="h-[50vh] min-h-64 overflow-hidden rounded-4 border border-outline-gray-1">
			<PythonEditor :model-value="snapshot.code" read-only />
		</div>

		<div class="flex items-end gap-2">
			<Button
				variant="solid"
				:icon="playing ? 'lucide-pause' : 'lucide-play'"
				:aria-label="playing ? 'Pause' : 'Play'"
				:tooltip="playing ? 'Pause' : 'Play'"
				@click="togglePlay"
			/>
			<div class="relative flex-1 pt-7">
				<div
					v-for="marker in markers"
					:key="marker.key"
					class="absolute top-0 -translate-x-1/2"
					:style="{ left: trackPosition(marker.index) }"
				>
					<Button
						variant="ghost"
						size="sm"
						:icon="marker.icon"
						class="!text-ink-amber-7"
						:aria-label="marker.text"
						:tooltip="marker.text"
						@click="jumpTo(marker.index)"
					/>
				</div>
				<input
					v-model.number="index"
					type="range"
					min="0"
					:max="lastIndex"
					aria-label="Replay position"
					class="h-8 w-full cursor-pointer rounded-1 [accent-color:var(--ink-gray-8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					@input="pause"
				/>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
			<p class="flex min-h-5 items-center gap-1.5 text-ink-gray-8">
				<template v-if="latestMarker">
					<span
						:class="[latestMarker.icon, 'size-4 shrink-0 text-ink-amber-7']"
						aria-hidden="true"
					/>
					{{ latestMarker.text }}
				</template>
			</p>
			<p class="tabular-nums text-ink-gray-5">{{ timeOf(snapshot.saved_at) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Button, Skeleton, useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { parseDatetime } from '@/lib/dates'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'

interface CodeReplay {
	snapshots: { saved_at: string; code: string }[]
	tab_leaves: string[]
	pastes: { pasted_at: string; line_count: number }[]
}

const PLAYBACK_SPEED = 40
const LONGEST_STEP_MS = 1000
const RANGE_THUMB_PX = 16

const props = defineProps<{ submission: string }>()

const replay = useCall<CodeReplay, { submission: string }>({
	url: '/api/v2/method/cs17_portal.code_replay.get_code_snapshots',
	params: () => ({ submission: props.submission }),
})

const failed = useLoadFailed(replay, { except: isRefusal })

const snapshots = computed(() => replay.data?.snapshots ?? [])
const savedAt = computed(() =>
	snapshots.value.map((snapshot) => parseDatetime(snapshot.saved_at).valueOf()),
)
const lastIndex = computed(() => Math.max(snapshots.value.length - 1, 0))

const index = ref(0)
const snapshot = computed(() => snapshots.value[index.value])

const markers = computed(() =>
	[
		...(replay.data?.tab_leaves ?? []).map((at) => ({
			at,
			label: 'Left the tab',
			icon: 'lucide-eye-off',
		})),
		...(replay.data?.pastes ?? []).map((paste) => ({
			at: paste.pasted_at,
			label: `Pasted ${paste.line_count} ${paste.line_count === 1 ? 'line' : 'lines'}`,
			icon: 'lucide-clipboard-paste',
		})),
	]
		.map((event) => ({ ...event, time: parseDatetime(event.at).valueOf() }))
		.sort((first, second) => first.time - second.time)
		.map((event) => {
			const after = savedAt.value.findIndex((saved) => saved >= event.time)
			return {
				key: `${event.icon}-${event.at}`,
				icon: event.icon,
				text: `${event.label} at ${timeOf(event.at)}`,
				index: after === -1 ? lastIndex.value : after,
			}
		}),
)

const latestMarker = computed(() =>
	markers.value.filter((marker) => marker.index <= index.value).at(-1),
)

function timeOf(value: string): string {
	return parseDatetime(value).format('MMM D, h:mm:ss A')
}

function trackPosition(markerIndex: number): string {
	const fraction = lastIndex.value ? markerIndex / lastIndex.value : 0
	return `calc(${fraction * 100}% + ${(0.5 - fraction) * RANGE_THUMB_PX}px)`
}

const playing = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function playNext() {
	if (index.value >= lastIndex.value) {
		playing.value = false
		return
	}
	const gap = savedAt.value[index.value + 1] - savedAt.value[index.value]
	timer = setTimeout(
		() => {
			index.value++
			playNext()
		},
		Math.min(gap / PLAYBACK_SPEED, LONGEST_STEP_MS),
	)
}

function togglePlay() {
	if (playing.value) {
		pause()
		return
	}
	if (index.value >= lastIndex.value) index.value = 0
	playing.value = true
	playNext()
}

function pause() {
	clearTimeout(timer)
	playing.value = false
}

function jumpTo(markerIndex: number) {
	pause()
	index.value = markerIndex
}

onBeforeUnmount(() => clearTimeout(timer))
</script>
