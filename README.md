# Licht und Freude

## Tailwind CSS

The public home page uses Tailwind utility classes. Rebuild its served stylesheet
after changing the template or Tailwind source with:

```sh
npm run build:css
```

The command scans `views/**/*.ejs` and writes the production stylesheet to
`public/css/alltag.css`.

## Production deployment with Docker

1. Copy `.env.example` to `.env` and set the production SMTP credentials.
2. Build and start the application:

   ```sh
   docker compose up --build -d
   ```

3. Check the container health:

   ```sh
   docker compose ps
   ```

The application is available on port `3005` by default. Set `PORT` in the
project's `.env` file to change the host port. The container listens on port
`3005` internally.

Set `SERVER_URL` in `.env` to the public base URL of the server if the website
is served from a different host (for example, `https://api.example.com`).
Leave it empty when the website and API use the same host.

Set `MONGODB_URI` to a MongoDB connection string. Only verified users whose
`isAdmin` property is `true` can access `/admin`, add companies, or manage
consultation requests. Set `isAdmin: true` on the intended user document in
MongoDB to grant administrator access.
For production, set `SERVER_URL` to the HTTPS site origin so verification links
and secure login cookies work correctly.

The admin company list at `/admin/companies` can be filtered by company name,
creation date, and proximity to a searched place. Location searches use
OpenStreetMap Nominatim and the stored coordinates; the entered address is not
retained. Admins can edit, pause/reactivate, or delete a company from its
confirmation modal. Paused companies remain visible in admin but are hidden
from the public Standort search on the home page. Public searches return active
companies from the database, filtered by the requested location and radius.
Public search displays each result's straight-line distance from the entered
location and links to a Google Maps route. The admin list shows the 500 newest
matches at most; public search returns up to 100.

The company form looks up its entered address with OpenStreetMap Nominatim.
The address is not saved; only longitude and latitude are stored in the company
location.

The image installs production dependencies only, runs as the unprivileged
`node` user, and does not include `.env`. Keep `.env` out of source control and
provide it securely to the deployment host.
