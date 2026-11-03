"use client";
import {useI18n} from "@/i18n/client";
import {RecoveryPanel} from "@/app/_landing/recovery-panel";
export default function LibraryError({retry}:{retry:()=>void}){
 const {t}=useI18n();
 return <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16"><RecoveryPanel retry={retry} dashboard title={t.library.loadError}/></main>;
}
