"use client";
import {RecoveryPanel} from "@/app/_landing/recovery-panel";
export default function DashboardError({retry}:{retry:()=>void}){
 return <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16"><RecoveryPanel retry={retry} dashboard/></main>;
}
