// Before first paint: honor an explicit query or saved choice, then use the
// same bright default as the homepage. The export name is kept for callers.
export const THEME_BY_TIME = `(function(){var d=document.documentElement,t;try{t=new URLSearchParams(location.search).get("theme");if(t!=="light"&&t!=="dark")t=localStorage.getItem("gooidy-theme")}catch(e){}if(t!=="light"&&t!=="dark")t="light";d.dataset.theme=t})()`;
