<template>
	<div v-if="comments.data?.length">
		<p class="text-xs text-ink-gray-5">Code comments</p>
		<ul class="mt-1 space-y-3">
			<li v-for="comment in comments.data" :key="comment.name" class="space-y-1">
				<p class="text-sm text-ink-gray-5">Line {{ comment.line }}</p>
				<code
					class="block whitespace-pre-wrap break-words rounded-2 bg-surface-gray-2 px-2 py-1 font-mono text-sm text-ink-gray-8"
					v-text="comment.code"
				/>
				<p class="whitespace-pre-line text-p-base text-ink-gray-8" dir="auto">
					{{ comment.comment }}
				</p>
			</li>
		</ul>
	</div>
	<ErrorMessage
		v-else-if="comments.error"
		:message="frappeErrorMessage(comments.error, 'Could not load the comments on your code.')"
	/>
</template>

<script setup lang="ts">
import { ErrorMessage, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { StudentCodeComment } from '@/types'

const props = defineProps<{ submission: string }>()

const comments = useCall<StudentCodeComment[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.code_comments.get_student_code_comments',
	params: () => ({ submission: props.submission }),
})
</script>
