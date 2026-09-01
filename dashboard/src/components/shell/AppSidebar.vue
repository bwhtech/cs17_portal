<template>
	<Sidebar width="14rem" class="border-r border-outline-gray-1">
		<SidebarHeader
			title="CS17"
			:subtitle="roleLine"
			:logo="logoUrl"
			:menu-items="accountOptions"
		/>

		<ScrollArea class="min-h-0 flex-1" viewport-class="px-1 pb-10 pt-2">
			<SidebarSection
				v-for="section in nav.sections"
				:key="section.label"
				:label="section.label"
			>
				<SidebarItem
					v-for="item in section.items"
					:key="item.label"
					:icon="item.icon"
					:label="item.label"
					:to="item.to"
					:active="isNavItemActive(item, route.path)"
					@click="item.href && openExternal(item.href)"
				>
					<template v-if="item.href" #suffix>
						<span
							class="lucide-external-link mr-1 size-3 text-ink-gray-4"
							aria-hidden="true"
						/>
					</template>
				</SidebarItem>
			</SidebarSection>

			<Divider class="my-2" />

			<SidebarSection>
				<SidebarItem
					:icon="nav.announcements.icon"
					:label="nav.announcements.label"
					:to="nav.announcements.to"
					:active="isNavItemActive(nav.announcements, route.path)"
				/>
			</SidebarSection>
		</ScrollArea>
	</Sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
	Divider,
	ScrollArea,
	Sidebar,
	SidebarHeader,
	SidebarItem,
	SidebarSection,
	dialog,
} from 'frappe-ui'
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
