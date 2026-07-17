export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem("theme");
		if (stored === "dark" || stored === "light") return stored;
	} catch {}
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
	setThemeClass(theme);
	try {
		localStorage.setItem("theme", theme);
	} catch {}
}

function setThemeClass(theme: Theme): void {
	document.documentElement.classList.toggle("dark", theme === "dark");
}
