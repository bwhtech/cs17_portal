import { effectScope } from 'vue'
import { useCall } from 'frappe-ui'

function fetchNames(method: 'get_cohorts' | 'get_quarters') {
	return useCall<string[]>({
		url: `/api/v2/method/cs17_portal.api.${method}`,
		method: 'GET',
		cacheKey: [method],
	})
}

type NamesCall = ReturnType<typeof fetchNames>

const scope = effectScope(true)
let cohortsCall: NamesCall | undefined
let quartersCall: NamesCall | undefined

export function useCohorts(): NamesCall {
	cohortsCall ??= scope.run(() => fetchNames('get_cohorts'))
	if (!cohortsCall) throw new Error('useCohorts() could not start its request')
	return cohortsCall
}

export function useQuarters(): NamesCall {
	quartersCall ??= scope.run(() => fetchNames('get_quarters'))
	if (!quartersCall) throw new Error('useQuarters() could not start its request')
	return quartersCall
}
