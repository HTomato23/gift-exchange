// Event settings shown on the dashboard. Edit these values, save, and the site updates.
// (They live here because the database has no table for event details.)
export const EVENT = {
  // Gift budget per person, e.g. '₱500' or '₱500 – ₱1,000'
  giftAmount: '₱ 1,000',
  // Line under the amount, and a small label like the Potluck one ('' to hide the label)
  giftAmountNote: 'Budget per gift',
  giftAmountExtra: 'Wrap it with love',

  // When and where the exchange happens, e.g. 'Dec 24, 7:00 PM' and "Lola's house"
  date: 'December 27, 2026 | 6:00 PM',
  location: 'Matienzo Compound',

  // Extra line under the place on the Event Details tile ('' to hide it)
  extra: 'Potluck · Bring a dish!',

  // Day the dashboard counts down to (month 1–12). Repeats every year.
  countdownTo: { month: 12, day: 27 },

  // Contact shown on the Privacy Policy page (/privacy)
  contactEmail: 'bautistalanz0423@gmail.com',
}
