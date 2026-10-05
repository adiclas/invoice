import { getMessages } from "@/i18n/messages";
import { buildFaqJsonLd } from "@/lib/seo";

type Feature = { title: string; body: string };
type Faq = { q: string; a: string };

/*
 * The lists are objects keyed "1", "2", "3" rather than arrays: next-intl's
 * AbstractIntlMessages does not permit arrays in a message file, so a JSON
 * array here fails to typecheck the moment the messages are loaded.
 */
type Landing = {
    h1: string;
    intro: string;
    /** The guide's own heading and lede, so the two pages are not duplicates. */
    guideH1?: string;
    guideIntro?: string;
    featuresHeading: string;
    features: Record<string, Feature>;
    howHeading: string;
    how: Record<string, Feature>;
    faqHeading: string;
    faq: Record<string, Faq>;
};

/**
 * The page's indexable content.
 *
 * Before this, `app/[locale]/page.tsx` was twelve lines that rendered the
 * builder and nothing else: no prose at all, and its only `<h1>` was a form
 * label reading "Invoice". A crawler arriving at a free invoice generator
 * found no sentence explaining that that is what it was.
 *
 * A server component on purpose — this is the half of the page that must exist
 * in the HTML rather than after hydration, and it keeps the builder's client
 * bundle unchanged.
 *
 * It sits *below* the app shell. The shell is viewport-height and its panes
 * scroll internally, so nothing here competes with the builder or pushes it
 * around; you only meet it if you scroll past the tool.
 */
type Variant = "home" | "guide";

/**
 * `home` keeps the page rankable without burying the builder: the heading, the
 * intro and the FAQ, whose schema is the part that earns a rich result.
 * `guide` carries the long-form sections on their own page.
 *
 * One component and one set of message keys serve both, so the two cannot
 * drift apart.
 */
export default async function LandingContent({
    locale,
    variant = "home",
}: {
    locale: string;
    variant?: Variant;
}) {
    const messages = await getMessages(locale);
    const landing = (messages as Record<string, unknown>)?.landing as
        | Landing
        | undefined;

    if (!landing) return null;

    const isGuide = variant === "guide";

    return (
        <section className="border-t border-border bg-card">
        </section>
    );
}
