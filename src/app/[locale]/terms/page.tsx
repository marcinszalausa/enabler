import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { alternates, isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/app/_landing/legal";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getMessages(locale);
  return {
    title: t.meta.termsTitle,
    description: "The terms for using Gooidy.",
    alternates: alternates(locale, "/terms"),
  };
}

export default async function Terms({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <LegalPage
      locale={locale}
      title={t.footer.terms}
      updated="October 29, 2026"
    >
      <p>
        These terms apply when you use Gooidy. By creating an account you agree
        to them. We keep them short and plain on purpose.
      </p>

      <h2>Your account</h2>
      <p>
        You need a valid email address to sign in. Keep access to it safe, as
        anyone who can open your sign-in emails can use your account.
      </p>

      <h2>Credits and plans</h2>
      <p>
        Making ads uses credits. Free accounts start with a set number of
        credits, and paid plans add credits every month, as shown on our{" "}
        <Link href="/#pricing">pricing</Link>. Plans are month to month, and you
        can cancel at any time; you keep access until the end of the period you
        paid for.
      </p>

      <h2>Your content and your ads</h2>
      <ul>
        <li>
          Only use links, images, logos and brands you have the right to use.
        </li>
        <li>
          The ads Gooidy makes for you are yours to use, change and publish.
        </li>
        <li>
          You give us permission to process what you upload and the pages you
          share, only to make and store your ads.
        </li>
      </ul>

      <h2>Check before you publish</h2>
      <p>
        Ads are made by AI models and can contain mistakes. Review every ad
        before you run it, and make sure it follows the rules of the platforms
        you use, such as Meta and TikTok, and the laws where you advertise.
      </p>

      <h2>Fair use</h2>
      <p>
        Don&apos;t use Gooidy to make misleading, harmful, hateful or illegal
        ads, to copy other brands, or to overload or attack the service. We may
        suspend accounts that do.
      </p>

      <h2>The service</h2>
      <p>
        We work hard to keep Gooidy running well, but it is provided as is, and
        some features may change. To the extent the law allows, our liability is
        limited to the amount you paid us in the last 12 months.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms in a way that matters, we will tell you by
        email before the change applies.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See
        also our <Link href="/privacy">privacy page</Link>.
      </p>
    </LegalPage>
  );
}
