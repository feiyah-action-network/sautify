# Feiyah Action Network homepage

Static site for feiyahactionnetwork.org, built for Netlify hosting. Plain HTML,
compiled Tailwind CSS, and a small vanilla JS file. No framework.

## Structure

- `index.html` - the homepage
- `transparency.html` - financial transparency page (linked from the donation module)
- `thanks.html` - form success page (Netlify Forms redirect target)
- `css/styles.css` - compiled Tailwind output (committed, so the site deploys even without a build)
- `js/main.js` - scroll reveal, donation module UI, mobile sticky donate bar
- `images/` - photographs taken from the existing FAN site, resized and compressed, with WebP versions
- `src/input.css` + `tailwind.config.js` - Tailwind source

## Deploying

Create a Netlify site from this repo with the **base directory set to
`feiyah-site`** so the `netlify.toml` in this folder applies. The build command
recompiles the CSS; the publish directory is this folder itself.

## Editing styles

```
npm install
npm run build     # or: npm run watch
```

Commit the regenerated `css/styles.css` together with your HTML changes.

## Where the content came from

Copy is grounded in the live feiyahactionnetwork.org site (mission, programs,
team, contact details) and in FAN's own printed banner photographed in
`images/hero-gathering.jpg`, which supplies the mission statement, the vision,
the founding and registration dates, and the figure of 16 girls rescued.

Two details on the banner are worth a second look before launch:

- The banner says FAN was **founded in 2008 and registered in 2010**, while the
  current website says founded 2010. This site uses the banner's version.
- The banner names **UNFPA and ActionAid** as partners, plus a third logo that
  is too small to read in the photograph. If that third partner is Samburu
  Women Trust, add it to the partners section.

## Before launch: still to supply

Search the HTML for `data-placeholder` and `TODO`.

1. **Registration number** (`index.html` trust box, `transparency.html`): the
   CBO registration number and the registering authority.
2. **Further impact figures** (`index.html`, impact section): girls supported
   through the education program, women trained in land governance, and
   communities reached by Komesha FGM Sasa. The impact page on the current site
   lists these as unconfirmed, so nothing is published here yet.
3. **Donation tier costs** (`index.html`, donation module): confirm that $25,
   $50, and $100 match real unit costs for sanitary supplies, a women's circle,
   and a Komesha FGM Sasa gathering.
4. **Partner logos** (`index.html`, partners section): swap the text lockups for
   official ActionAid and UNFPA logo files once permission is in writing.
5. **Photograph consent**: confirm FAN holds consent to publish photographs of
   identifiable girls and community members, since this site gives them more
   prominence than the current one.
6. **Reports** (`transparency.html`): link the annual report, financial policy,
   and safeguarding policy when published.

## Donation module

UI only. The submit handler in `js/main.js` (`handleDonationSubmit`) is a stub.
When a payment processor (Stripe or Donorbox) is confirmed, wire it through a
Netlify Function so secret keys stay server side. The donation form must never
use Netlify Forms attributes; only the newsletter and contact forms use
`data-netlify="true"`.

FAN already takes M-Pesa and is setting up PayPal. The paybill and account
numbers are blank on the current site, so this page points donors to
info@feiyahactionnetwork.org instead of showing incomplete payment details.

## Copy conventions

No em dashes anywhere in the copy, including HTML entities such as `&mdash;`.
Use periods, commas, or parentheses.
