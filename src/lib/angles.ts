// The ad angles Claude writes for, as visitors read them.
export const ANGLES: Record<string, { name: string; idea: string }> = {
  pain: {
    name: "Pain point",
    idea: "Opens with a problem the buyer already has.",
  },
  benefit: {
    name: "Benefit",
    idea: "Leads with how life gets better with the product.",
  },
  social_proof: {
    name: "Social proof",
    idea: "Gives a reason other people choose it, without made-up reviews.",
  },
  offer: {
    name: "Offer",
    idea: "Puts the price, deal or reason to buy now up front.",
  },
  curiosity: {
    name: "Curiosity",
    idea: "Gives people a reason to stop and look closer.",
  },
};

export const angleName = (a: string) => ANGLES[a]?.name ?? a.replace("_", " ");
