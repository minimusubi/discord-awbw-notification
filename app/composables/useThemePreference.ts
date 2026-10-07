type ThemeName = 'dark' | 'light';

const DEVICE_THEME_STORAGE_KEY = 'last-device-theme';

export function useThemePreference() {
	const colorMode = useColorMode();
	const initialized = useState('theme-preference-initialized', () => false);
	const isDark = computed(() => colorMode.value === 'dark');

	function initialize() {
		if (!import.meta.client || initialized.value) {
			return;
		}

		const deviceThemeQuery = window.matchMedia(
			'(prefers-color-scheme: dark)',
		);
		const currentDeviceTheme = getDeviceTheme(deviceThemeQuery.matches);
		const storedDeviceTheme = readStoredDeviceTheme();

		if (
			storedDeviceTheme
			&& storedDeviceTheme !== currentDeviceTheme
			&& colorMode.value !== currentDeviceTheme
		) {
			colorMode.preference = currentDeviceTheme;
		}
		writeStoredDeviceTheme(currentDeviceTheme);

		deviceThemeQuery.addEventListener('change', ({ matches }) => {
			const deviceTheme = getDeviceTheme(matches);

			if (colorMode.value !== deviceTheme) {
				colorMode.preference = deviceTheme;
			}

			writeStoredDeviceTheme(deviceTheme);
		});
		initialized.value = true;
	}

	function readStoredDeviceTheme(): ThemeName | null {
		try {
			const storedDeviceTheme = window.localStorage.getItem(
				DEVICE_THEME_STORAGE_KEY,
			);

			if (storedDeviceTheme === 'dark' || storedDeviceTheme === 'light') {
				return storedDeviceTheme;
			}
		} catch {
			// Ignore unavailable local storage.
		}
		return null;
	}

	function writeStoredDeviceTheme(deviceTheme: ThemeName) {
		try {
			window.localStorage.setItem(DEVICE_THEME_STORAGE_KEY, deviceTheme);
		} catch {
			// The active theme still works when storage is unavailable.
		}
	}

	function toggleTheme() {
		colorMode.preference = isDark.value ? 'light' : 'dark';
	}

	return { initialize, isDark, toggleTheme };
}

function getDeviceTheme(prefersDark: boolean): ThemeName {
	return prefersDark ? 'dark' : 'light';
}
