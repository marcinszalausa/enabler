// Gooidy's AI avatars: original, fictional people drawn by an image model,
// never real people or lookalikes. Admins generate the images once from
// /dashboard/admin; owners can also create their own for credits.

export const AVATAR_GENDERS = ["woman", "man", "nonbinary"] as const;
export const AVATAR_AGES = ["young", "adult", "mature", "senior"] as const;
export const AVATAR_LOOKS = ["casual", "business", "sporty", "elegant"] as const;
export type AvatarGender = (typeof AVATAR_GENDERS)[number];
export type AvatarAge = (typeof AVATAR_AGES)[number];
export type AvatarLook = (typeof AVATAR_LOOKS)[number];

// Creating a custom avatar: one Nano Banana Pro portrait (about $0.14) plus
// headroom for a retry, in line with ~$0.05 cost per credit.
export const AVATAR_CREDITS = 10;
export const AVATAR_NAME_MAX = 40;
export const AVATAR_DESCRIPTION_MAX = 300;

export type LibraryAvatar = {
  slug: string;
  name: string;
  gender: AvatarGender;
  age: AvatarAge;
  look: AvatarLook;
  description: string;
};

const a = (name: string, gender: AvatarGender, age: AvatarAge, look: AvatarLook, description: string): LibraryAvatar =>
  ({ slug: `${gender}-${age}-${look}-${name.toLowerCase().replace(/[^a-z]/g, "")}`, name, gender, age, look, description });

export const AVATAR_LIBRARY: LibraryAvatar[] = [
  a("Maya", "woman", "young", "casual", "a woman in her early twenties with warm brown skin and curly black shoulder-length hair, wearing a cream knit sweater"),
  a("Aiko", "woman", "young", "business", "an East Asian woman in her mid twenties with a sleek black bob, wearing a navy blazer over a white tee"),
  a("Sofia", "woman", "young", "sporty", "a Latina woman in her early twenties with a long dark ponytail, wearing a sports top and a light zip jacket"),
  a("Amara", "woman", "young", "elegant", "a Black woman in her mid twenties with short natural hair, wearing an emerald silk blouse and small gold earrings"),
  a("Hannah", "woman", "adult", "casual", "a white woman in her mid thirties with wavy auburn hair and light freckles, wearing a soft denim shirt"),
  a("Priya", "woman", "adult", "business", "a South Asian woman in her late thirties with long dark hair tied back, wearing a charcoal blazer"),
  a("Leila", "woman", "adult", "sporty", "a Middle Eastern woman in her early thirties with dark hair in a braid, wearing an athletic top and running jacket"),
  a("Elena", "woman", "adult", "elegant", "an Eastern European woman around forty with blonde shoulder-length hair, wearing a black turtleneck and pearl studs"),
  a("Grace", "woman", "mature", "casual", "a Black woman around fifty with gray-streaked locs, wearing a relaxed linen shirt"),
  a("Mei", "woman", "mature", "business", "an East Asian woman around fifty with short silver-streaked hair and thin glasses, wearing a camel coat"),
  a("Carmen", "woman", "mature", "sporty", "a Latina woman in her early fifties with short dark hair, wearing a fleece pullover"),
  a("Isabel", "woman", "mature", "elegant", "a white woman in her mid fifties with a silver bob, wearing a cream blouse and a delicate necklace"),
  a("Ruth", "woman", "senior", "casual", "a white woman in her late sixties with short white hair and a warm smile, wearing a soft cardigan"),
  a("Nadia", "woman", "senior", "business", "a South Asian woman in her mid sixties with gray hair in a low bun, wearing a tailored maroon jacket"),
  a("June", "woman", "senior", "sporty", "an East Asian woman around seventy with short gray hair, wearing a light windbreaker"),
  a("Adaeze", "woman", "senior", "elegant", "a Black woman in her late sixties with short white natural hair, wearing a deep blue dress and statement earrings"),
  a("Leo", "man", "young", "casual", "a white man in his early twenties with tousled light brown hair, wearing a gray hoodie"),
  a("Daniel", "man", "young", "business", "an East Asian man in his mid twenties with neat black hair, wearing a light blue shirt with an open collar"),
  a("Malik", "man", "young", "sporty", "a Black man in his early twenties with a short fade, wearing a fitted training tee"),
  a("Mateo", "man", "young", "elegant", "a Latino man in his mid twenties with swept-back dark hair, wearing a black knit polo"),
  a("Ravi", "man", "adult", "casual", "a South Asian man in his mid thirties with a short beard, wearing an olive overshirt"),
  a("James", "man", "adult", "business", "a white man in his late thirties with short brown hair, wearing a navy suit with an open collar"),
  a("Kwame", "man", "adult", "sporty", "a Black man in his early thirties with a shaved head, wearing an athletic quarter-zip"),
  a("Omar", "man", "adult", "elegant", "a Middle Eastern man around forty with a trimmed beard, wearing a charcoal turtleneck"),
  a("Tomas", "man", "mature", "casual", "a Latino man around fifty with salt-and-pepper hair, wearing a flannel shirt"),
  a("Kenji", "man", "mature", "business", "an East Asian man around fifty with graying side-parted hair and glasses, wearing a gray blazer"),
  a("Erik", "man", "mature", "sporty", "a white man in his early fifties with short gray hair, wearing a cycling jacket"),
  a("Samuel", "man", "mature", "elegant", "a Black man in his mid fifties with a neat gray beard, wearing a camel blazer"),
  a("Walter", "man", "senior", "casual", "a white man in his late sixties with white hair, wearing a cardigan over a checked shirt"),
  a("Arjun", "man", "senior", "business", "a South Asian man in his mid sixties with white hair and glasses, wearing a tweed jacket"),
  a("Hiro", "man", "senior", "sporty", "an East Asian man around seventy with short white hair, wearing a hiking vest"),
  a("Joseph", "man", "senior", "elegant", "a Black man in his late sixties with a white beard, wearing a dark suit with a pocket square"),
];

const AGE_WORDS: Record<AvatarAge, string> = {
  young: "aged 20 to 29",
  adult: "aged 30 to 44",
  mature: "aged 45 to 59",
  senior: "aged 60 or older",
};
const LOOK_WORDS: Record<AvatarLook, string> = {
  casual: "casual everyday clothes",
  business: "smart business clothes",
  sporty: "sporty activewear",
  elegant: "elegant, refined clothes",
};
const GENDER_WORDS: Record<AvatarGender, string> = { woman: "woman", man: "man", nonbinary: "non-binary person" };

const PORTRAIT = "Photorealistic waist-up portrait, facing the camera with a relaxed, friendly expression, on a seamless light gray studio backdrop with soft even light and natural skin texture. Vertical framing. No text, no logos, no brand names, no watermarks.";

export function avatarLibraryPrompt(item: LibraryAvatar) {
  return `A fictional, AI-generated adult: ${item.description}. Not a real or famous person. ${PORTRAIT}`;
}

// A custom avatar's written identity, kept with it and shown to image models.
export function customAvatarDescription(o: { gender: AvatarGender; age: AvatarAge; look: AvatarLook; details: string }) {
  const details = o.details.replace(/\s+/g, " ").trim();
  return `an adult ${GENDER_WORDS[o.gender]} ${AGE_WORDS[o.age]}, wearing ${LOOK_WORDS[o.look]}${details ? `; ${details}` : ""}`.slice(0, 600);
}

export function customAvatarPrompt(description: string, withPhoto: boolean) {
  return withPhoto
    ? `Create a studio portrait of the person in this photo, keeping their face, hair and skin tone recognizably the same: ${description}. ${PORTRAIT}`
    : `A fictional, AI-generated adult: ${description}. Not a real or famous person. ${PORTRAIT}`;
}

export function avatarLibraryPath(slug: string) {
  return `library/avatars/${slug}.jpg`;
}
