import type {ReactNode} from "react";
import Link from "next/link";
import {CreateNew,MobileMenu,SidebarBody} from "./app-shell";
import {ActivityAside,ActivityProvider,ActivityToggle,MenuFold,MenuFrame} from "./activity-panel";
import "./app-studio.css";

// The same presentation frame surrounds every signed-in page. Data and
// permissions stay with the authenticated layout and its server components.
export function DashboardFrame({children,nav,account,credits,activity,workspaceLabel,skipLabel}:{
 children:ReactNode;nav:ReactNode;account:ReactNode;credits:ReactNode;activity:ReactNode;workspaceLabel:string;skipLabel:string;
}){
 return <ActivityProvider><div className="app-studio flex flex-1 bg-bg text-fg [&_.grid>*]:min-w-0" data-app-studio>
  <a href="#app-content" className="skip-link">{skipLabel}</a>
  <MenuFrame><SidebarBody nav={nav} account={account} fold={<MenuFold/>}/></MenuFrame>
  <div className="app-workspace flex min-w-0 flex-1 flex-col">
   <header className="app-workspace-header sticky top-0 z-30 border-b border-line">
    <div className="app-workspace-toolbar flex items-center gap-2">
     <MobileMenu><SidebarBody nav={nav} account={account}/></MobileMenu>
     <Link href="/dashboard" className="app-workspace-label">{workspaceLabel}</Link>
     <div className="ms-auto flex min-w-0 items-center gap-1 sm:gap-2"><CreateNew/>{credits}<ActivityToggle/></div>
    </div>
   </header>
   <div id="app-content" tabIndex={-1} className="app-content flex flex-1 flex-col focus:outline-none">{children}</div>
  </div>
  <ActivityAside>{activity}</ActivityAside>
 </div></ActivityProvider>;
}
