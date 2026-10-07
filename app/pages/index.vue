<template>
	<div>
		<section class="awbw-hero">
			<div class="container awbw-hero__layout">
				<div class="awbw-hero__copy">
					<span class="eyebrow">Advance Wars By Web</span>
					<h1>Get pinged when your turn starts.</h1>
					<p>
						Add your AWBW username and game link. The Discord bot
						will notify you in the server when it is your turn.
					</p>
					<div class="d-flex flex-wrap gap-3 mt-4">
						<NuxtLink
							class="btn btn-primary btn-lg rounded-pill px-4"
							to="/dashboard"
						>
							Manage game alerts
							<span class="material-symbols-outlined ms-2"
								>arrow_forward</span
							>
						</NuxtLink>
						<a
							class="btn btn-ghost btn-lg rounded-pill px-4"
							href="https://awbw.amarriner.com/"
							target="_blank"
							rel="noreferrer"
						>
							Open AWBW
							<span class="material-symbols-outlined ms-2"
								>open_in_new</span
							>
						</a>
					</div>
					<div class="awbw-hero__note mt-4">
						<span class="material-symbols-outlined"
							>notifications_active</span
						>
						Sign in with Discord to manage alerts for your server.
					</div>
				</div>

				<article class="awbw-notification-preview">
					<div class="awbw-notification-preview__top">
						<span class="awbw-notification-preview__bot-icon">
							<span class="material-symbols-outlined"
								>sports_esports</span
							>
						</span>
						<span>
							<strong>AWBW Turn Alerts</strong>
							<small>BOT · #game-alerts</small>
						</span>
					</div>
					<div class="awbw-notification-preview__message">
						<strong>It’s your turn, @Player!</strong>
						<p>Your turn has started in AWBW game #1741266.</p>
						<span class="awbw-notification-preview__link">
							<span class="material-symbols-outlined"
								>open_in_new</span
							>
							Open game
						</span>
					</div>
					<div class="awbw-notification-preview__footer">
						<span class="awbw-notification-preview__status"></span>
						Turn alert delivered
					</div>
				</article>
			</div>
		</section>

		<section class="feature-section py-5">
			<div class="container py-5">
				<div class="section-heading text-center mx-auto">
					<span class="eyebrow">Quick setup</span>
					<h2 class="mt-3">Stay on top of every turn</h2>
					<p>
						Set up a game alert for yourself or another server
						member.
					</p>
				</div>
				<div class="row g-4 mt-4">
					<div class="col-md-4">
						<article class="feature-card h-100">
							<span class="feature-card__icon is-purple">
								<span class="material-symbols-outlined"
									>link</span
								>
							</span>
							<h3>Add a game</h3>
							<p>
								Paste the AWBW game link and your in-game
								username.
							</p>
						</article>
					</div>
					<div class="col-md-4">
						<article class="feature-card h-100">
							<span class="feature-card__icon is-coral">
								<span class="material-symbols-outlined"
									>alternate_email</span
								>
							</span>
							<h3>Choose the ping</h3>
							<p>
								Select the Discord member and channel for the
								alert.
							</p>
						</article>
					</div>
					<div class="col-md-4">
						<article class="feature-card h-100">
							<span class="feature-card__icon is-mint">
								<span class="material-symbols-outlined"
									>notifications_active</span
								>
							</span>
							<h3>Get notified</h3>
							<p>
								The bot watches the game and pings when your
								turn begins.
							</p>
						</article>
					</div>
				</div>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
	useHead({ title: 'Get notified when your turn starts' });
</script>
