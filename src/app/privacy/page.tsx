import { CONTACT_EMAIL, LegalPage } from "../_landing/legal";

export const metadata = {
  title: "Privacy · Gooidy",
  description:
    "What Gooidy collects, why, who helps us run it, and your choices.",
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="October 29, 2026">
      <p>
        Gooidy turns a product link into ads. To do that we need a little
        information from you and from the page you share. This page explains
        what we collect, why, and what you can ask us to do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, used to sign you in
          with a one-time link and to contact you about your account.
        </li>
        <li>
          <strong>What you give us to make ads:</strong> the links you paste,
          the public text and images we read from those pages, and your brand
          kit (logo, colors and font).
        </li>
        <li>
          <strong>What we make for you:</strong> the ads, copy, voiceovers and
          videos generated in your account.
        </li>
        <li>
          <strong>Billing:</strong> when paid plans are on, payments are handled
          by Stripe. We never see or store your full card number.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run Gooidy: to make and store your ads, keep your account
        secure, count credits, answer you and improve the product. We do not
        sell your data, and we do not show your ads or brand publicly without
        your permission.
      </p>

      <h2>Who helps us run Gooidy</h2>
      <p>We use a few trusted services, each only for its part of the work:</p>
      <ul>
        <li>Vercel hosts the website.</li>
        <li>Supabase stores accounts, ads and files, and handles sign-in.</li>
        <li>Anthropic (Claude) reads product pages and writes ad copy.</li>
        <li>fal.ai runs the image, video, voice and music models.</li>
        <li>Resend sends sign-in emails.</li>
        <li>Stripe processes payments.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use only what the site needs to work: a cookie that keeps you signed
        in, and a setting in your browser that remembers light or dark mode. We
        count page visits with Vercel Web Analytics, which uses no cookies and
        doesn&apos;t identify you. No advertising trackers.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and ads while your account is open. When you delete
        your account, or ask us to, we delete your data within 30 days, except
        what we must keep by law, such as payment records.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask for a copy of your data, ask us to correct it, or ask us to
        delete it at any time. If you are in the EU or UK, you also have the
        rights the GDPR gives you, including the right to complain to your data
        protection authority.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
