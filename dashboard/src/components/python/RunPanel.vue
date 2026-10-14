<template>
	<Tabs v-model="tab" class="flex flex-col">
		<div class="flex items-center gap-3 border-b border-outline-gray-1 px-3 sm:px-5">
			<TabList variant="underline">
				<TabTrigger value="input" label="Input" />
				<TabTrigger value="output" label="Output" />
			</TabList>
			<span class="ml-auto truncate text-sm text-ink-gray-5" aria-live="polite">
				{{ statusLine }}
			</span>
		</div>

		<TabPanel value="input" class="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5">
			<Textarea
				v-model="stdin"
				class="[&_textarea]:font-mono"
				label="Text your program reads"
				description="Each input() call reads the next line."
				:rows="4"
				spellcheck="false"
			/>
		</TabPanel>

		<TabPanel value="output" class="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5">
			<p v-if="!result" class="text-p-sm text-ink-gray-5">
				{{ running ? 'Running…' : 'Run your program to see what it prints.' }}
			</p>
			<template v-else-if="result.status === 'finished'">
				<pre
					v-if="result.stdout"
					class="whitespace-pre-wrap break-words font-mono text-sm text-ink-gray-8"
					v-text="result.stdout"
				/>
				<pre
					v-if="result.stderr || result.error"
					class="whitespace-pre-wrap break-words font-mono text-sm text-ink-red-6"
					v-text="`${result.stderr}${result.error ?? ''}`"
				/>
				<p v-if="asksForMoreInput" class="mt-2 text-p-sm text-ink-gray-5">
					Your program asked for more lines than the Input tab has.
				</p>
				<p
					v-if="!result.stdout && !result.stderr && !result.error"
					class="text-p-sm text-ink-gray-5"
				>
					The program printed nothing.
				</p>
			</template>
			<p v-else-if="result.status === 'timed-out'" class="text-p-sm text-ink-red-6">
				Stopped after {{ result.timeoutMs / 1000 }} seconds. A loop that never ends does
				this.
			</p>
			<p v-else class="text-p-sm text-ink-red-6">
				Could not start Python. Check your internet connection and run again.
			</p>
		</TabPanel>
	</Tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TabList, TabPanel, TabTrigger, Tabs, Textarea } from 'frappe-ui'
import type { RunResult } from '@/lib/python/runner'

const props = defineProps<{
	result: RunResult | null
	running: boolean
}>()

const stdin = defineModel<string>('stdin', { required: true })
const tab = defineModel<string>('tab', { required: true })

const asksForMoreInput = computed(
	() => props.result?.status === 'finished' && Boolean(props.result.error?.includes('EOFError')),
)

const statusLine = computed(() => {
	if (props.running) return 'Running…'
	if (props.result?.status === 'finished')
		return props.result.error ? 'Ended with an error' : 'Finished'
	return ''
})
</script>
