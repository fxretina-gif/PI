# The Witness Circle · Arya Samaj wedding

**Live page:** https://marvelous-cornflowerblue-sheep-56.hostingersite.com/

**Organiser:** https://marvelous-cornflowerblue-sheep-56.hostingersite.com/admin

## Edit and build

Edit `wedding.json` for names, date, time, temple and city. Edit `web/` for the
HTML/CSS/JavaScript. Run `npm run build` (Node 18+; no package installation).
Commit both source and `public/` to GitHub. Deploy `main` using this site's
hPanel Git deployment or pull the same commit in its existing hosting checkout.

```text
PI/
  wedding.json              Wedding details
  web/                      Page, CSS, JavaScript and icon
  server/api.php            PHP registration/review API source
  server/config.example.php Example private configuration
  public/                   Built files served by Hostinger
  scripts/build.mjs          Build command
  scripts/setup.php          Private setup and DB migrations
  drizzle/                  Versioned SQLite migrations
  .local/                   Local access notes, ignored by Git
```

The root `.htaccess` serves `public/` and blocks source/config directories.
Built assets are committed so hosting needs no Node build process.

## Witness flow

A slim, single-line dinner announcement sits flush between the header and wedding
hero: “After the wedding, let’s celebrate together over a special dinner.” The
strip and blinking eye open a dinner invitation.
The olive-and-gold strip uses larger cream text and a gold eye button. On phones,
the single-line sentence scrolls slowly; reduced motion allows manual scrolling.
There is no gap above or below the strip.
Its underlined restaurant location opens the same map chooser and copy-address
action as the wedding venue. Closing the map chooser returns to the dinner
invitation. Reduced motion disables the blink.
The dinner invitation unrolls as a parchment scroll with gold rollers and tassels,
styled from the user's reference. A brief canvas maple-leaf burst runs on opening,
cleans up on close and is skipped for reduced motion. Restaurant map controls remain
available inside the scroll.
The dinner venue is Madhurima Sweets & Restaurant, Vibhuti Khand Road, Gomti
Nagar. Its address, coordinates and Google Place ID were matched to the user's
shared location at https://share.google/LjpnBh68BbPbHGtRs. Restaurant directions
use that exact pin; wedding directions continue to use the Arya Samaj address.

The hero shows the wedding details, venue and the first registration step
together. The venue opens a glass map chooser with Google Maps directions and
Android's available map apps or Apple Maps. Guests can also copy the venue
address. Map links use the provided venue address.

Step 1 asks only for a name, with no dropdown. Step 2 requires four
photos: one passport-size witness photo, PAN card, Aadhaar front and Aadhaar back. Each supports
upload, camera capture, preview and replacement. The mobile content is centered;
the invitation popup leads back to the form. Photos are resized before upload,
validated by the server and stored privately for organiser review. Step 3 shows
all four previews and requires confirmation before submission. Identical Aadhaar
front and back images are rejected. Dates of birth are not included in the page
or public configuration. The white theme uses olive and charcoal text, muted red accents, self-hosted
Bootstrap Icons and clear glass cards. The header centres the compact gold Ganesha artwork supplied by the user, without
visible text. A beating heart between the couple’s names releases small fading
hearts; the ceremony label has matching dashes on both sides. A white canvas garden animates 42 floating blossoms and 14 maple leaves
on desktop, with 26 blossoms and 9 leaves on mobile. There are no water effects. Motion
pauses when the page is hidden and becomes still for reduced-motion preferences.

Each witness must also bring Aadhaar, PAN and two printed passport-size
photographs to the ceremony. Four witnesses are needed: two from the bride's
side and two from the groom's side, coordinated by the organiser. Cards 1–2 sit
under “Isha - Bride” and cards 3–4 under “Praveen - Groom”; the groups stack on
mobile. The submission thank-you uses a smaller single-line heading with the
witness’s first name in the same muted red as the couple’s heart.

Submissions remain pending until manual review in `/admin`. The organiser checks
name, document photos and attendance, then confirms a witness. Each approval books one of four
places and updates the shared public counter: **1 witness booked · 3 open**.
Open cards show an “Open Place” tag; confirmed cards show the witness portrait
and “Thankyou 😊”. Releasing a place removes its public portrait.
Concurrent approvals cannot exceed four. The counter refreshes every 15 seconds
and when a visitor returns to the tab. Duplicate active names are
blocked; up to 12 submissions can await review.

## Private storage and organiser access

PHP 8.2+ and PDO SQLite are required. The database, document photos and password
hash live in `witness-private/` **outside `public_html`** and are never in Git.
Only the organiser's authenticated PHP session can see submissions and ID document
photos. A confirmed witness’s portrait is available publicly as a 160×200 JPEG
thumbnail through a versioned slot URL. Pending portraits and uploaded originals
stay private; releasing or deleting a place revokes its portrait URL. Earlier
records and photos remain accessible. New submissions require
PAN, both Aadhaar sides and one witness photo, without collecting a phone number.
Cookies are Secure, HttpOnly and SameSite=Strict; admin writes also require a
CSRF token and matching origin. Password attempts are rate-limited. Public
responses contain counts, place numbers and confirmed portrait URLs. The review
consent explains portrait display; Aadhaar and PAN are never served publicly.

The local organiser login note is `.local/organiser-access.json`, excluded from
Git. The admin can decline a submission, release a place, or permanently delete
the submission and all its photos. Verification is manual; no government Aadhaar
verification service is called. Delete documents when no longer needed.

## Fresh hosting setup

Point the domain at this Git checkout with PHP enabled. Run `scripts/setup.php`
over SSH, passing an absolute private storage directory **outside the document
root** as the argument and a JSON object containing a strong `password` on stdin.
Only a hash is stored. Never put passwords in arguments, source or commits.
Setup applies SQL migrations; re-running preserves the existing admin password.

The API reads `../../witness-private/config.php` relative to `public/api.php`;
`WITNESS_CONFIG` can select another server-private path. Host data survives Git
deployments because it is outside the checkout. There are no package dependencies.

## Verification

`node tests/live.mjs .local/organiser-access.json` runs the live API smoke checks
on a fresh empty site. It creates labelled synthetic names, tests required PAN uploads, document
privacy, duplicate prevention and concurrent approvals, and deletes all its records. Do
not run it after real witnesses have started registering. The upload API was
also tested against an isolated temporary database on the hosting server. The
three-step form, popup, upload previews, camera capture and success flow were checked at desktop, 390px and
320px widths without creating live submissions.
