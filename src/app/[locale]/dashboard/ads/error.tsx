"use client";
import {useI18n} from "@/i18n/client";
export default function LibraryError({reset}:{reset:()=>void}){
 const {t}=useI18n();return <section role="alert" className="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-line p-6"><h2 className="text-lg font-semibold">{t.library.loadError}</h2><button type="button" onClick={reset} className="btn-primary mt-4 min-h-11 rounded-xl px-4 text-sm font-medium">{t.run.check}</button></section>;
}
