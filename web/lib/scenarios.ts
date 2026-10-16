/** Scenario catalogue for the Home cards. Titles mirror api/app/scenarios.py; colours stand in for photos. */

export type Scenario = {
  slug: string;
  title: string;
  blurb: string;
  minutes: number;
  /** Three saturated colours that stand in for a blurred photo. */
  vivid: [string, string, string];
};

export const scenarios: Scenario[] = [
  { slug: "bakery", title: "Bakery", blurb: "Order bread, ask for a bag, pay.", minutes: 5, vivid: ["#FFB36B", "#FF7FA3", "#FFD08A"] },
  { slug: "train", title: "Train ticket", blurb: "Buy a ticket, ask about the delay.", minutes: 6, vivid: ["#6FB3FF", "#9C8CFF", "#B8E8D6"] },
  { slug: "doctor", title: "Doctor", blurb: "Describe what hurts, book a follow-up.", minutes: 8, vivid: ["#5FD3B3", "#9FC9FF", "#C9B6FF"] },
  { slug: "landlord", title: "Landlord", blurb: "The heating is broken. Again.", minutes: 8, vivid: ["#A58BFF", "#FF9EC4", "#FFB38A"] },
  { slug: "party", title: "Party small talk", blurb: "Who are you, how do you know the host?", minutes: 7, vivid: ["#FF7FB0", "#FFB36B", "#C9B6FF"] },
  { slug: "interview", title: "Job interview", blurb: "Introduce yourself, talk about strengths.", minutes: 10, vivid: ["#7FB8FF", "#B8E8D6", "#FFD08A"] },
  { slug: "free", title: "Free talk", blurb: "No script. Just talk.", minutes: 10, vivid: ["#FFB38A", "#C9B6FF", "#9FC9FF"] },
];

