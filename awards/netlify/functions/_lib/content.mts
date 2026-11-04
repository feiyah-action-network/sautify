import { BASE } from "./env.mts";
import { kes } from "./layout.mts";

// Site copy. Plain English with some Swahili. No em dashes.
// DRAFT legal text: to be reviewed by Sautify before launch.

const CONTACT = "hamed.nalle@sautify.co.ke";

export const rulesBody = (price: number) => `
<p>These rules apply to the Sautify Awards 2027. Sautify runs the awards and makes the final decision on any question about them.</p>
<h2>1. Who can be nominated</h2>
<ul><li>Kenyan creators, venues and organisations, nominated through our registration process or by the Sautify team.</li>
<li>Every nominee is checked by our team before they appear on this site.</li></ul>
<h2>2. Public voting</h2>
<ul><li>Each vote costs <b>${kes(price)}</b>, paid by M-Pesa. You can vote as many times as you like.</li>
<li>A vote only counts once M-Pesa confirms the payment. If you pay less than you chose, we count only the votes your payment covers.</li>
<li>Each category has an opening and a closing time, shown on its page in East Africa Time. Votes outside these times are refused.</li>
<li>Leadership categories and Lifetime Achievement have no public vote. They are decided by the jury only.</li>
<li>While voting is open, category pages show each nominee's rank. Exact vote counts stay private until results are published.</li></ul>
<h2>3. How winners are chosen</h2>
<p>In public-vote categories, each nominee's final score out of 100 is:</p>
<p><b>Final score = (60% &times; jury score) + (40% &times; public vote share)</b></p>
<ul><li><b>Jury score</b>: each juror scores every finalist from 1 to 10 on three criteria. We average the scores and convert them to a number out of 100.</li>
<li><b>Public vote share</b>: the nominee's share of all confirmed votes in the category, out of 100. For example, a nominee with 2,000 of the category's 8,000 votes has a share of 25.</li></ul>
<p>Jury-only categories use the jury score alone. The highest final score wins.</p>
<h2>4. Fair play</h2>
<ul><li>We watch for fraud, such as unauthorised use of other people's M-Pesa accounts or automated voting. Votes linked to fraud may be removed, and a nominee who takes part in it may be disqualified.</li>
<li>Jurors declare any conflict of interest and do not score nominees they are connected to.</li></ul>
<h2>5. Results</h2>
<p>Results are published category by category on this site. We keep the vote and jury records behind each result so it can be checked later.</p>
<p>Questions? Write to <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`;

export const faqBody = (price: number) => {
  const qa: [string, string][] = [
    ["How do I vote?", `Open a nominee's page, choose how many votes, enter your Safaricom number and tap Piga kura. An M-Pesa prompt appears on your phone. Enter your PIN and your votes are counted as soon as the payment is confirmed.`],
    ["How much does a vote cost?", `${kes(price)} per vote. There is no extra fee for voters.`],
    ["I paid but the page did not update. Did my vote count?", "Yes, if M-Pesa took the money. We check every payment with our payment provider again within 10 minutes, so your votes count even if the page lost connection. Do not pay a second time unless you want extra votes."],
    ["The prompt did not appear on my phone.", "Check that the number is a Safaricom line with M-Pesa and that your phone is on. Wait a minute and try again. For your safety, one number can only receive 5 unpaid prompts in 10 minutes."],
    ["Can I vote for more than one nominee?", "Yes. You can vote for anyone in any open category, as many times as you like."],
    ["Can I see the vote counts?", "While voting is open we show each nominee's rank, not exact numbers. Full results are published when each category closes."],
    ["Is my number shared with anyone?", `No. We keep your number only as a scrambled code and a masked version like 0712 *** 678. See our <a href="${BASE}/privacy">privacy notice</a>.`],
    ["Can I get a refund?", `Votes are not refundable once counted. If something went wrong, for example you were charged twice or paid less than one vote, write to ${CONTACT} with your M-Pesa message and we will help.`],
    ["How do I become a nominee?", "Creator registration opens soon on this site. Every registration is reviewed before it appears publicly."],
  ];
  return qa.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("");
};

export const privacyBody = (req: string | null) => `
${req === "ok" ? '<p class="notice" role="status">Asante. We have your request and will reply within 7 days.</p>' : ""}
${req === "missing" ? '<p class="notice bad" role="alert">Please tell us how to contact you.</p>' : ""}
${req === "error" ? '<p class="notice bad" role="alert">We could not save your request. Please email us instead.</p>' : ""}
<p>This notice explains what personal data the Sautify Awards collect, why, and your rights under Kenya's Data Protection Act, 2019. Sautify is the data controller. Contact: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
<h2>What we collect when you vote</h2>
<ul><li><b>Your phone number</b>, which we need to send the M-Pesa prompt. We pass it to our payment provider for that purpose only. In our own records we keep only a scrambled code (a one-way hash) and a masked version such as 0712 *** 678. We never store the full number.</li>
<li><b>Payment details</b>: amount, time, payment status and the M-Pesa reference, so we can count your votes correctly and handle refunds.</li>
<li><b>A scrambled code of your internet address</b>, used only to stop abuse such as floods of payment prompts.</li></ul>
<p>We do not collect your name, ID number or location to vote. We do not sell personal data or use it for advertising.</p>
<h2>Who else handles it</h2>
<ul><li>IntaSend and Safaricom M-Pesa, to process your payment.</li>
<li>Supabase and Netlify, who host our database and website. Some of this data may be stored on servers outside Kenya, with safeguards required by law.</li></ul>
<h2>How long we keep it</h2>
<p>Vote and payment records are kept for up to 24 months after the awards, so results and payments can be audited, and then deleted. Internet address codes are deleted after 90 days.</p>
<h2>Your rights</h2>
<p>You can ask to see the data we hold about you, to correct it, or to delete it. If we delete your records, votes already counted stay in the totals but can no longer be linked to you. You may also complain to the Office of the Data Protection Commissioner.</p>
<h2 id="request">Make a request</h2>
<form method="post" action="${BASE}/api/data-request">
<label>What would you like?<select name="kind"><option value="delete">Delete my data</option><option value="access">See my data</option></select></label>
<label>The phone number you voted with (optional)<input name="phone" type="tel" inputmode="tel" placeholder="0712 345 678"></label>
<label>How should we contact you? (email or phone)<input name="contact" required minlength="5" maxlength="200"></label>
<label>Anything else (optional)<textarea name="details" rows="3" maxlength="1000"></textarea></label>
<button class="btn ink" type="submit">Send request</button>
</form>
<h2>Muhtasari kwa Kiswahili</h2>
<p>Tunakusanya nambari yako ya simu ili kukutumia ombi la malipo la M-Pesa, pamoja na maelezo ya malipo. Katika kumbukumbu zetu tunahifadhi nambari hiyo kwa njia iliyofichwa pekee. Hatuuzi taarifa zako. Una haki ya kuomba kuona, kurekebisha au kufuta taarifa zako kupitia fomu iliyo hapo juu au kwa barua pepe ${CONTACT}.</p>
<p class="muted">Last updated 4 November 2026.</p>`;

export const termsBody = (price: number) => `
<p>By voting in the Sautify Awards you agree to these terms and to the <a href="${BASE}/rules">rules</a>.</p>
<h2>1. What you are paying for</h2>
<p>Each vote costs ${kes(price)}. Your payment buys votes for the nominee you chose. It is not a donation, a bet or a purchase of goods, and it does not give you any prize or reward.</p>
<h2>2. When a vote counts</h2>
<p>A vote counts only after our payment provider confirms that the M-Pesa payment is complete. If the amount received is less than the amount requested, we count only the whole votes the amount covers.</p>
<h2>3. Refunds</h2>
<p>Votes that have been counted are not refundable. We will refund a payment that was taken in error, for example a double charge, or an amount too small to buy one vote. Write to ${CONTACT} within 30 days with your M-Pesa confirmation message.</p>
<h2>4. Your M-Pesa account</h2>
<p>Only vote with an M-Pesa account you own or are allowed to use. Votes paid with a stolen or misused account will be removed.</p>
<h2>5. Fair play and changes</h2>
<p>We may remove votes linked to fraud or abuse, and we may change voting dates or pause voting if there is a technical or security problem. Any change will be posted on this site.</p>
<h2>6. Liability</h2>
<p>We are not responsible for delays or failures caused by M-Pesa, mobile networks or other services outside our control. Nothing in these terms limits your rights under Kenyan law.</p>
<p class="muted">Last updated 4 November 2026. Sautify, Kenya.</p>`;
