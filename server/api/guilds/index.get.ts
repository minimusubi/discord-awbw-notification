import { getManagedGuilds } from '../../utils/discordAuth.js';

export default defineEventHandler((event) => getManagedGuilds(event));
