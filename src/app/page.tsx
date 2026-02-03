import { HomeClient } from "@/components/HomeClient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#e9eaed] animate-fade-in">
      <SiteHeader />
      <HomeClient />
      <SiteFooter />
    </div>
  );
}
