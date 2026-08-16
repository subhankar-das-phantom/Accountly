export const CONTRIBUTION_CATEGORIES = [
  "Donation",
  "Sponsorship",
  "Ticket Sales",
  "Membership Dues",
  "Grants",
  "Merchandise Sales",
  "Miscellaneous"
];

export const EXPENSE_CATEGORIES = [
  "Decoration",
  "Food & Refreshments",
  "Prizes & Gifts",
  "Event Materials",
  "Transportation",
  "Marketing",
  "Venue Rental",
  "Equipment",
  "Miscellaneous"
];

export const ALL_CATEGORIES = [
  ...new Set([...CONTRIBUTION_CATEGORIES, ...EXPENSE_CATEGORIES])
].sort();
