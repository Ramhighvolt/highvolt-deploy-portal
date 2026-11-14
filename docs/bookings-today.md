# Bookings Today

The portal section reads booking v2. It does not enable a site and it does not create appointments.

With `BOOKINGS_API_BASE` or `BOOKINGS_PORTAL_API_TOKEN` unset, the page shows five site cards and zero bookings. All five cards are `switch_off`. HighVolt's website keeps the Microsoft Bookings link while `BOOKING_V2_ENABLED_HVA` is off. Importing appointments that already exist in Microsoft Bookings is a separate follow-up and is not done here.

`BOOKINGS_API_BASE` is the booking function origin, with no path. The portal calls `/api/v2/staff/bookings` with `BOOKINGS_PORTAL_API_TOKEN`.

The portal does not store SQL passwords, connection strings, or the database server name. It calls the booking API, which reads the five site databases and the legacy QVM table. One unavailable site database leaves the other sites visible. Legacy QVM rows are read only.

Anyone who already passes Entra sign-in and `ALLOWED_EMAILS` can read bookings. There is no second viewer list. The API token stays in the server route and is not returned to the browser.

The page shows a month calendar grid with weekday headings and day cells. Previous month, Next month, Today, site, and assignee filters remain available. Bookings appear inside their date; overflow uses a “+N more” control. Clicking a booking or “+N more” opens a popup with site, attendee, time and timezone, assignee, status, and that site’s questions and answers. The popup closes with Close, Escape, or an outside click.

One site that cannot be read stays marked unavailable. Existing Microsoft Bookings appointments are shown read-only and are not recreated. Legacy QVM v1 bookings stay in a separate read-only list (and still appear on the calendar when dated).

Calendar invitees (visitor and staff) stay separate from staff email status. `create_unconfirmed` stays visible until a lookup finds the event. `send_unconfirmed` is not retried.

The detail action "Read private note" calls the read-only legacy-note endpoint. It does not create a meeting.

`lib/websites.ts` maps `quantumedupass.com` to `HighVolt-Analytics/Quantum-Edupass`. `BOOKING_V2_ENABLED_EDUPASS` stays off. A booking detail shows the country the visitor selected. The roster market is derived on the server from that country.
