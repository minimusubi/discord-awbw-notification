import type { AuthSessionResponse } from '#shared/types/dashboard';

export default defineNuxtRouteMiddleware(async (to) => {
	const requestHeaders =
		import.meta.server ? useRequestHeaders(['cookie']) : undefined;
	const session = await $fetch<AuthSessionResponse>('/api/auth/session', {
		headers: requestHeaders,
	}).catch(() => null);
	if (!session?.authenticated) {
		return navigateTo({
			path: '/login',
			query: { returnTo: to.fullPath },
		});
	}
});
