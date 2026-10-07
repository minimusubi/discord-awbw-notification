<template>
	<section class="login-section">
		<div class="container py-5">
			<div class="login-card mx-auto">
				<div
					class="login-card__art"
					aria-hidden="true"
				>
					<span class="login-star login-star--one">✦</span>
					<span class="login-star login-star--two">✦</span>
					<div class="login-orbit">
						<span class="material-symbols-outlined">groups</span>
					</div>
				</div>
				<div class="login-card__content">
					<span class="eyebrow">Welcome back</span>
					<h1 class="mt-3">Manage your AWBW alerts.</h1>
					<p class="mt-3">
						Sign in with Discord to manage game notifications in
						servers where you can manage the bot.
					</p>
					<a
						class="btn btn-discord btn-lg w-100 mt-4"
						:href="loginURL"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path
								d="M18.654 5.893a15.832 15.832 0 0 0-3.909-1.212.06.06 0 0 0-.062.03c-.17.3-.356.691-.487 1a14.617 14.617 0 0 0-4.39 0c-.13-.315-.324-.7-.494-1a.062.062 0 0 0-.062-.03 15.79 15.79 0 0 0-3.91 1.212.056.056 0 0 0-.025.022c-2.49 3.719-3.171 7.346-2.837 10.928a.066.066 0 0 0 .025.045A15.922 15.922 0 0 0 7.3 19.312a.062.062 0 0 0 .067-.022c.37-.505.698-1.036.98-1.596a.06.06 0 0 0-.033-.084 10.49 10.49 0 0 1-1.497-.714.062.062 0 0 1-.006-.102c.1-.076.201-.154.297-.233a.06.06 0 0 1 .062-.009c3.142 1.435 6.544 1.435 9.65 0a.06.06 0 0 1 .062.008c.096.08.197.159.298.234a.062.062 0 0 1-.005.102c-.478.28-.976.516-1.498.713a.061.061 0 0 0-.033.085c.288.559.617 1.09.98 1.595a.06.06 0 0 0 .067.023 15.869 15.869 0 0 0 4.802-2.424.062.062 0 0 0 .025-.044c.4-4.141-.67-7.739-2.838-10.928a.049.049 0 0 0-.025-.023Zm-9.838 8.77c-.946 0-1.726-.87-1.726-1.936 0-1.067.765-1.935 1.726-1.935.969 0 1.74.876 1.725 1.935 0 1.067-.764 1.935-1.725 1.935Zm6.38 0c-.946 0-1.726-.87-1.726-1.936 0-1.067.765-1.935 1.726-1.935.968 0 1.74.876 1.725 1.935 0 1.067-.757 1.935-1.725 1.935Z"
							></path>
						</svg>
						Continue with Discord
					</a>
					<div class="login-note mt-4">
						<span class="material-symbols-outlined">lock</span>
						<span
							>We only request your profile and server list. Your
							password stays with Discord.</span
						>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script lang="ts" setup>
	const route = useRoute();
	const returnTo = computed(() => {
		const value = route.query.returnTo;
		return (
				typeof value === 'string'
					&& value.startsWith('/')
					&& !value.startsWith('//')
			) ?
				value
			:	'/dashboard';
	});
	const loginURL = computed(
		() =>
			`/api/auth/discord?returnTo=${encodeURIComponent(returnTo.value)}`,
	);

	useHead({ title: 'Log in' });
</script>
