<template>
	<Sidebar width="14rem" class="border-r border-outline-gray-1">
		<SidebarHeader
			title="CS17"
			:subtitle="roleLine"
			:logo="logoUrl"
			:menu-items="accountOptions"
		/>

		<!-- The app owns the scroll region; padding the viewport gives the active
		     row's shadow room so `overflow-hidden` doesn't clip it. -->
		<ScrollArea class="min-h-0 flex-1" viewport-class="px-2 pt-0.5 pb-10">
			<template v-for="(section, index) in nav.sections" :key="section.label">
				<div class="flex h-7 items-center" :class="index > 0 && 'mt-4'">
					<SidebarLabel>{{ section.label }}</SidebarLabel>
				</div>
				<nav class="mt-0.5 space-y-0.5">
					<SidebarItem
						v-for="item in section.items"
						:key="item.label"
						:active="isNavItemActive(item, route.path)"
						:to="item.to"
						@click="item.href && openExternal(item.href)"
					>
						<template #prefix>
							<span :class="item.icon" class="size-4" aria-hidden="true" />
						</template>
						<span class="flex-1 truncate text-sm">{{ item.label }}</span>
						<template v-if="item.href" #suffix>
							<span
								class="lucide-external-link mr-1 size-3 text-ink-gray-4"
								aria-hidden="true"
							/>
						</template>
					</SidebarItem>
				</nav>
			</template>

			<nav class="mt-4 space-y-0.5">
				<SidebarItem
					:active="isNavItemActive(nav.announcements, route.path)"
					:to="nav.announcements.to"
				>
					<template #prefix>
						<span :class="nav.announcements.icon" class="size-4" aria-hidden="true" />
					</template>
					<span class="flex-1 truncate text-sm">{{ nav.announcements.label }}</span>
				</SidebarItem>
			</nav>
		</ScrollArea>
	</Sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ScrollArea, Sidebar, SidebarHeader, SidebarItem, SidebarLabel, dialog } from 'frappe-ui'
import logoUrl from '@/assets/CS17.svg'
import { isNavItemActive, navConfig } from '@/components/shell/nav'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const route = useRoute()
const { isFaculty, cohort, logout } = useSession()
const settings = useSettingsDialog()

const nav = computed(() => navConfig(isFaculty.value))
// Students are identified by their cohort, faculty simply by the role. The
// signed-in name sits in the account menu's Settings dialog instead — a long
// one overruns the header's subtitle line.
const roleLine = computed(() => (isFaculty.value ? 'Faculty' : `cohort '${cohort.value ?? '—'}'`))

const accountOptions = [
	{ label: 'Settings', icon: 'lucide-settings', onClick: () => settings.open() },
	{
		label: 'Log out',
		icon: 'lucide-log-out',
		theme: 'red' as const,
		onClick: () =>
			dialog.danger({
				title: 'Log out',
				message: 'Are you sure you want to log out?',
				confirmLabel: 'Log out',
				onConfirm: () => logout(),
			}),
	},
]

function openExternal(href: string) {
	window.open(href, '_blank', 'noopener')
}
</script>
