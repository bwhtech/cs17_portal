<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Safe Exam Browser</h2>
		<ol
			class="list-decimal space-y-2 rounded-4 border border-outline-gray-1 bg-surface-base py-4 pl-9 pr-4 text-p-sm text-ink-gray-7"
		>
			<li>
				In SEB Config Tool (on a Mac, SEB Preferences), on the General tab, set Start URL to
				this exam's link:
				<div class="mt-1 flex items-center gap-1">
					<p
						class="min-w-0 flex-1 select-all break-all rounded-2 bg-surface-gray-2 px-2 py-1 font-mono text-sm text-ink-gray-8"
					>
						{{ startUrl }}
					</p>
					<Button
						variant="ghost"
						icon="lucide-copy"
						aria-label="Copy the start URL"
						tooltip="Copy"
						@click="copyStartUrl"
					/>
				</div>
			</li>
			<li>On the Exam tab, tick "Use Browser Exam Key and Config Key".</li>
			<li>On the Config File tab, pick "Starting an exam", then save the file.</li>
			<li>
				Copy the Browser Exam Key from the Exam tab into this exam with Edit. Saving the
				file again changes the key.
			</li>
			<li>
				Each SEB version and platform has its own key. Add a key for each one your students
				use, separated by a space.
			</li>
			<li>Give students the saved .seb file.</li>
		</ol>
	</section>
</template>

<script setup lang="ts">
import { Button, toast } from 'frappe-ui'

const props = defineProps<{ startUrl: string }>()

async function copyStartUrl() {
	try {
		await navigator.clipboard.writeText(props.startUrl)
		toast.success('Link copied')
	} catch {
		toast.error('Could not copy the link.')
	}
}
</script>
