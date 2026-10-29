// Picks light or dark before first paint: ?theme=light|dark, then the
// choice saved by the toggle on this device, then the visitor's local time
// (light from 7:00 to 19:00). Inlined in <head> on every page.
export const THEME_BY_TIME = `(function(){var d=document.documentElement,t;try{t=new URLSearchParams(location.search).get("theme");if(t!=="light"&&t!=="dark")t=localStorage.getItem("gooidy-theme")}catch(e){}if(t!=="light"&&t!=="dark"){var h=new Date().getHours();t=h>=7&&h<19?"light":"dark"}d.dataset.theme=t})()`;
