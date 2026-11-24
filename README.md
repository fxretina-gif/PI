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

Full name and Indian mobile number are required; connection is optional.
Passport-size photo, Aadhaar front and Aadhaar back are all mandatory. Each
supports upload, live camera capture, native phone-camera fallback, preview and
replacement. Photos are resized to 1800px and converted to JPEG before sending,
removing EXIF metadata. The PHP API validates actual image contents and sizes.

Submissions remain pending until manual review in `/admin`. The organiser checks
photos and attendance, then verifies a witness. Each approval books one of four
places and updates the shared public counter: **1 witness booked · 3 open**.
Concurrent approvals cannot exceed four. The counter refreshes every 15 seconds
and when a visitor returns to the tab. Duplicate active mobile numbers are
blocked; up to 12 submissions can await review.

## Private storage and organiser access

PHP 8.2+ and PDO SQLite are required. The database, document photos and password
hash live in `witness-private/` **outside `public_html`** and are never in Git.
Only the organiser's authenticated PHP session can see submissions or documents.
Cookies are Secure, HttpOnly and SameSite=Strict; admin writes also require a
CSRF token and matching origin. Password attempts are rate-limited. Public
responses contain counts and place numbers only.

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

Camera capture needs HTTPS and browser permission. Check the intended physical
phones before sharing. If HEIC decoding is unsupported, use JPG/PNG/WebP or take
a new photo. No camera stream is uploaded; only captured stills are submitted.

## Verification

`node tests/live.mjs .local/organiser-access.json` runs the live API smoke checks
on a fresh empty site. It creates labelled synthetic submissions, tests document
privacy and concurrent approvals, and deletes all its records/photos. Do not run
it after real witnesses have started registering. The initial deployment was also
checked in a 390px mobile browser through photo upload, simulated camera capture,
submission, organiser login, approval and the shared booking counter.
