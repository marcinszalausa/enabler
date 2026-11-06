import {Inngest} from "inngest";
// Explicit cloud mode in deployed environments; never disable signature verification in production.
export const inngest=new Inngest({id:"gooidy-catalog",isDev:process.env.NODE_ENV==="production"?false:process.env.INNGEST_DEV==="1"});
