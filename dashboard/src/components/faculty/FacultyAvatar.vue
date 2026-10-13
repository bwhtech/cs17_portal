<template>
	<Avatar :image="member.profile_picture ?? undefined" :label="member.full_name" />
</template>

<script setup lang="ts">
import { Avatar } from 'frappe-ui'
import type { FacultyMember } from '@/types'

defineProps<{ member: FacultyMember }>()
</script>
