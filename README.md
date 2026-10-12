# AWBW Turn Alerts

A Discord bot and Nuxt dashboard for turn notifications in [Advance Wars By Web](https://awbw.amarriner.com/). A player can sign up in a Discord channel with:

```text
/awbw notify username:bloopybopp game-url:https://awbw.amarriner.com/game.php?games_id=1741266
```

The bot checks that the AWBW username belongs to the game, then pings the Discord user in that channel when the player's turn starts. Pings and dashboard signups use the game's public name. `/awbw list` shows a user's signups and `/awbw remove` removes one. Server managers can add and remove signups for members through the web dashboard.

## Setup

Use Node.js 22 or newer. Install dependencies with `npm ci`, then copy `.env.example` to `.env.dev` for local development or `.env` for production and fill in the Discord settings.

- `DISCORD_TOKEN` and `DISCORD_APPLICATION_ID` identify the bot. Invite it with the `bot` and `applications.commands` scopes, plus permission to view channels, read message history, and send messages in notification channels. Enable the Server Members Intent in the Discord Developer Portal so the dashboard can offer a member picker.
- `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, and `SESSION_PASSWORD` enable dashboard sign-in. Set the redirect URI to the public dashboard origin followed by `/api/auth/discord/callback`, and register that URI in the Discord application. The session password must have at least 32 characters.
- `ASDF_PERSISTENT_DIR` is optional. Set it to a persistent writable directory in production. The bot stores signups in `db.json` there; otherwise it uses `data/db.json`.

Start locally with `npm run dev`. Build with `npm run build` and run the built server with `npm start`. The bot runs inside the Nuxt server and registers its global `/awbw` command at startup. Global command changes can take time to appear in Discord.

Run **one server process** against the data file. Each process opens its own AWBW sockets, and the JSON store is not designed for writes from multiple processes. Keep the process running for notifications; a static Nuxt deployment will not run the bot.

## How monitoring works

The public AWBW game page provides the game's player IDs and current turn. The bot maps the supplied username to all matching `players_id` values in that game, which differ from the account's `users_id`. It keeps one websocket connection per game, regardless of the number of signups, and sends AWBW's empty heartbeat frame every 45 seconds. A `NextTurn` socket message identifies the next player and triggers the ping. Reconnection delays double after failures, up to one minute, and reset after a stable connection. The bot checks the current turn at startup, after reconnecting, and once a minute while running, so it can catch a turn change missed while offline.

The bot saves each signup's last notified game day and player seat. Adding a signup during an active turn does not send an immediate ping; it waits for the next turn. If Discord delivery fails, the next refresh retries. After an interruption, the bot alerts the currently active turn if it has not already sent an alert for that turn. Turns that began and ended entirely while the bot was offline cannot be recovered from the current game page.

Each turn alert mentions all subscribed users for that game in the channel. After posting it, the bot removes its older alerts for the same game in that channel. It leaves alerts for other games and messages from other users alone. On the first alert after this feature is enabled, it checks the channel history for older bot alerts; later alerts use saved message IDs.

When AWBW sends a `GameOver` event, the bot removes every signup for that game and closes its socket. Page checks also remove completed games if the event arrived while the bot was offline. Completed games cannot be added again.
