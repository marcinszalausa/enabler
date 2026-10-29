import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-24">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        Enabler
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Ads that sell, made in minutes.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
        Paste your product or website link. Enabler writes the copy, designs
        image and video ads, and gets them ready for Meta and TikTok.
      </p>
      <div className="mt-8">
        <Link
          href="/login"
          className="rounded-md bg-neutral-900 px-4 py-2.5 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
