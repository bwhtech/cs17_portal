<template>
	<MobileNav>
		<MobileNavItem
			v-for="item in nav.mobile"
			:key="item.label"
			:label="item.label"
			:icon="item.icon"
			:to="item.to"
			:active="isNavItemActive(item, route.path)"
		/>
		<MobileNavItem label="You" @click="sheetOpen = true">
			<Avatar
				size="sm"
				:image="profile?.profile_picture ?? undefined"
				:label="profile?.full_name ?? ''"
			/>
		</MobileNavItem>
	</MobileNav>

	<!-- Everything the desktop sidebar carries that the four tabs don't. -->
	<BottomSheet v-model:open="sheetOpen" :title="profile?.full_name ?? 'You'">
		<div class="flex flex-col gap-1 pb-4">
			<button
				v-for="item in sheetItems"
				:key="item.label"
				class="flex items-center gap-3 rounded-4 px-3 py-2.5 text-left text-base text-ink-gray-8 hover:bg-surface-gray-2"
				@click="run(item)"
			>
				<span :class="[item.icon, 'size-4 text-ink-gray-6']" aria-hidden="true" />
				{{ item.label }}
				<span
					v-if="item.href"
					class="lucide-external-link ml-auto size-3 text-ink-gray-4"
					aria-hidden="true"
				/>
			</button>
		</div>
	</BottomSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, BottomSheet, MobileNav, MobileNavItem } from 'frappe-ui'
import { isNavItemActive, navConfig, type NavItem } from '@/components/shell/nav'
import { useSession } from '@/composables/useSession'

const route = useRoute()
const router = useRouter()
const { profile, isFaculty } = useSession()

const sheetOpen = ref(false)
const nav = computed(() => navConfig(isFaculty.value))

/** The sidebar rows that didn't make it into the tab bar. */
const sheetItems = computed<NavItem[]>(() => {
	const inTabs = new Set(nav.value.mobile.map((item) => item.to))
	return nav.value.sections
		.flatMap((section) => section.items)
		.filter((item) => item.href || !inTabs.has(item.to))
})

function run(item: NavItem) {
	sheetOpen.value = false
	if (item.href) window.open(item.href, '_blank', 'noopener')
	else if (item.to) router.push(item.to)
}
</script>
