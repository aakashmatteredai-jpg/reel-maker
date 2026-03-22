export const DEFAULT_FONT = "Arial";

export const SYSTEM_FONTS = new Set([
	"Arial",
	"Helvetica",
	"Times New Roman",
	"Courier New",
	"Verdana",
	"Georgia",
	"monospace",
	"sans-serif",
	"serif",
]);

export interface FontInfo {
	id: string;
	name: string;
}

export const FONT_FAMILIES: FontInfo[] = [
	{ id: "inter", name: "Inter" },
	{ id: "roboto", name: "Roboto" },
	{ id: "poppins", name: "Poppins" },
	{ id: "montserrat", name: "Montserrat" },
	{ id: "lato", name: "Lato" },
	{ id: "oswald", name: "Oswald" },
	{ id: "raleway", name: "Raleway" },
	{ id: "nunito", name: "Nunito" },
	{ id: "ubuntu", name: "Ubuntu" },
	{ id: "rubik", name: "Rubik" },
];
