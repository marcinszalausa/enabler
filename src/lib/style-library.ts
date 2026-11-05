// Gooidy's own style references: original AI images, grouped by the kind of
// ad they show. The product in each is a plain, unbranded stand-in and every
// person is AI-generated, so nothing copies a real brand, ad or person.
// Admins generate the images once from /dashboard/admin.

export const STYLE_CATEGORIES = [
  "showcase", "lifestyle", "tryon", "flatlay", "handheld", "unboxing", "beforeafter", "studio",
] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

export type LibraryStyle = {
  slug: string;
  category: StyleCategory;
  // Shown to the image model as a written style guide (also used by models
  // that take only one image).
  style: string;
};

const s = (category: StyleCategory, slug: string, style: string): LibraryStyle => ({ slug: `${category}-${slug}`, category, style });

export const STYLE_LIBRARY: LibraryStyle[] = [
  s("showcase", "pedestal", "Product centered on a stone pedestal, soft daylight from the side, warm neutral backdrop, shallow depth of field"),
  s("showcase", "shadows", "Product on a sunlit surface with long leafy window shadows, minimal beige setting, crisp morning light"),
  s("showcase", "color-block", "Product against a bold single-color backdrop with a matching color floor, hard studio light and a clean drop shadow"),
  s("showcase", "water", "Product resting on wet glossy stones with water droplets and splashes, cool fresh light, close-up"),
  s("showcase", "floating", "Product floating mid-air with gentle motion, soft gradient background, playful levitation shot"),
  s("lifestyle", "kitchen", "Product in use on a bright home kitchen counter, morning sunlight, real lived-in details, candid feel"),
  s("lifestyle", "cafe", "Product on a small cafe table by a window, coffee cup nearby, soft natural light, cozy urban mood"),
  s("lifestyle", "outdoor", "Product outdoors on a picnic blanket in golden-hour light, grass and wildflowers, relaxed weekend mood"),
  s("lifestyle", "bedroom", "Product on a linen-covered bed in a calm bedroom, soft diffused light, slow morning atmosphere"),
  s("lifestyle", "desk", "Product on a tidy modern work desk with a laptop and plant, cool daylight, focused productive mood"),
  s("tryon", "mirror", "AI-generated model wearing the product, full-length mirror selfie in a bright apartment, natural pose"),
  s("tryon", "street", "AI-generated model wearing the product walking on a sunny city street, candid street-style photo"),
  s("tryon", "studio-full", "AI-generated model wearing the product, full body on a seamless light gray studio backdrop, editorial pose"),
  s("tryon", "closeup", "Close-up of the product worn by an AI-generated model, focus on fabric texture and fit, soft window light"),
  s("tryon", "home", "AI-generated model wearing the product at home on a sofa, relaxed natural pose, warm lamp light"),
  s("flatlay", "neutral", "Top-down flat lay of the product with a few matching accessories on a cream linen surface, even soft light"),
  s("flatlay", "marble", "Top-down flat lay of the product on white marble with gold accents and a small plant, bright clean light"),
  s("flatlay", "wood", "Top-down flat lay of the product on warm oak wood with natural props, soft afternoon light"),
  s("flatlay", "pastel", "Top-down flat lay of the product on a pastel paper background with geometric shapes, playful and bright"),
  s("flatlay", "travel", "Top-down flat lay of the product with travel items like a passport, map and sunglasses, adventure mood"),
  s("handheld", "selfie", "An AI-generated person's hand holding the product up to the camera, phone-camera UGC style, home background"),
  s("handheld", "outdoor", "Hand holding the product against a blue sky and greenery, bright natural light, casual phone photo"),
  s("handheld", "pov", "First-person view of hands using the product, cozy indoor setting, authentic everyday moment"),
  s("handheld", "smile", "AI-generated smiling person holding the product near their face, natural daylight, friendly creator style"),
  s("handheld", "car", "Hand holding the product inside a car with daylight through the window, on-the-go lifestyle"),
  s("unboxing", "box-open", "Product being lifted out of an open plain gift box with tissue paper, hands visible, soft warm light"),
  s("unboxing", "table", "Unboxing scene on a table with a plain kraft box, ribbon and the product revealed, top-down angle"),
  s("unboxing", "doorstep", "Plain parcel on a doorstep being opened to reveal the product, bright morning light, excitement mood"),
  s("unboxing", "gift", "Product presented as a gift with a plain wrapped box and a handwritten-style blank card, festive warm light"),
  s("unboxing", "lap", "Product in its plain box resting on an AI-generated person's lap on a sofa, cozy afternoon light"),
  s("beforeafter", "split", "Split-screen composition: left side dull and messy, right side bright and tidy with the product, clear contrast"),
  s("beforeafter", "routine", "Two-step layout showing a routine before and after using the product, clean bathroom setting, soft light"),
  s("beforeafter", "room", "Side-by-side of a plain room and the same room improved with the product, interior photo style"),
  s("beforeafter", "desk", "Before and after of a cluttered desk and an organized desk featuring the product, top-down angle"),
  s("beforeafter", "outfit", "Side-by-side of a plain outfit and an upgraded outfit with the product on an AI-generated model"),
  s("studio", "white", "Product on pure white seamless background, soft even studio lighting, e-commerce hero shot"),
  s("studio", "dark", "Product on a dark charcoal background with a single dramatic rim light, premium moody look"),
  s("studio", "gradient", "Product on a smooth color gradient background with soft reflections, modern tech-ad look"),
  s("studio", "props", "Product on a set of stacked geometric plinths in muted colors, soft studio light, design-magazine look"),
  s("studio", "spotlight", "Product under a round spotlight on a matte floor, theatrical light, high-end launch feel"),
];

// The scene the library image is drawn from: the style plus a plain stand-in.
export function libraryPrompt(item: LibraryStyle) {
  const stand = item.category === "tryon" ? "a plain unbranded knit cardigan" : "a plain unbranded ceramic bottle with a blank label";
  return `${item.style}. The product is ${stand}. Photorealistic advertising photograph, vertical framing. Every person is fictional and AI-generated. No text, no logos, no brand names, no watermarks.`;
}

export function libraryPath(slug: string) {
  return `library/styles/${slug}.jpg`;
}
