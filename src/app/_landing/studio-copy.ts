import type {Locale} from "@/i18n/config";
import type {Messages} from "@/i18n/messages";

export function studioCopy(locale:Locale,t:Messages){
 const english=locale==="en";
 return {
  eyebrow:english?"IMAGE & VIDEO ADS":t.home.badge,
  line1:english?"Your product.":t.home.titleLine1,
  line2:english?"Made to stand out.":t.home.titleBefore+t.home.titleWord+t.home.titleAfter,
  intro:english?"Turn a product link into ads worth stopping for.":t.home.intro,
  create:english?"Create your ads":t.urlForm.submit,
  placeholder:english?"Paste your product link":t.urlForm.placeholder,
  label:english?"Product link":t.urlForm.label,
  hint:english?"No card needed to explore.":t.home.finalSub,
  see:english?"See how it works":t.nav.how,
  examples:english?"Made with Gooidy":t.home.examplesTitle,
  sourceTitle:english?"One product photo.\nSo many possibilities.":t.beforeAfter.title,
  sourceBody:english?"One real product. Three messages. Two ad formats.":t.beforeAfter.compareHint,
  original:english?"Your product photo":t.beforeAfter.before,
  result:english?"Your next ad":t.publish.ads,
  feed:t.feed.facebook,
  story:t.feed.stories,
  sourceCta:english?"Make it yours":t.nav.getStarted,
  benefitsTitle:english?"Less busywork.\nMore showing up.":t.home.featuresTitle,
  brandTitle:english?"Feels like your brand.":t.home.kitTitle,
  brandBody:english?"Your look. Your voice. Every time.":t.home.kitBody,
  planTitle:english?"Create now. Post on your time.":t.nav.how,
  planBody:english?"Line up your content. Get on with your day.":t.home.whereTitle,
  pricingTitle:english?"Big ideas. Room to grow.":t.home.pricingTitle,
  pricingBody:english?"Launch. Grow. Scale. Find your fit.":t.home.pricingSub,
  pricingDetails:english?"Compare every feature":t.pricingPage.seeAll,
  faqTitle:english?"Good to know.":t.home.faqTitle,
  finalTitle:english?"Your next great ad\nstarts here.":t.home.finalTitle,
 };
}
export type StudioCopy=ReturnType<typeof studioCopy>;


