import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {HelpSearch} from "@/app/_landing/help-search";
export const metadata=informationMetadata("/help","Help center · Gooidy","Find straightforward answers about credits, creating ads, editing, publishing and your account.");
export default async function Page({params}:PageProps<"/[locale]/help">){const {locale}=await params;if(!isLocale(locale))notFound();return <InformationPage><div lang="en"><InformationHero eyebrow="Help center" title="Find your next step" description="Short guides for creating, reviewing and sharing your ads." locale={locale}/><HelpSearch locale={locale}/></div></InformationPage>;}
