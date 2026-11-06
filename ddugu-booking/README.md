# DDUGU Classroom Booking

A complete, dependency-free classroom booking website for **DDUGU** covering two connected
campus buildings — **IET** and **Deeksha Bhawan**. Pick a room on the interactive campus map,
watch it light up, and see its live schedule or book it in seconds.

No build step, no framework, no npm install — just open `index.html`.

---

## Quick start

1. Open `ddugu-booking/index.html` in a modern browser (double-click works).
2. Sign in with one of the demo accounts below.
3. Open **Campus Map** and click **IET** or **Deeksha Bhawan** to see its floor plans.
4. Click any room to make it glow and open its schedule + free slots.

Prefer a local server (recommended for consistent browser storage):

```powershell
cd "ddugu-booking"
python -m http.server 8000
# then open http://localhost:8000
```

Any static file server works, including VS Code Live Server.

---

## Demo accounts

Password for every account: **`demo123`**

| Role | Email | What you can do |
| --- | --- | --- |
| Student | `arjun.patel@ddgu.edu` | Request bookings (await approval), manage own schedule |
| Student | `sneha.reddy@ddgu.edu` | Same as above |
| Faculty | `priya.sharma@ddgu.edu` | Instant confirmed bookings, report conflicts |
| Faculty | `amit.singh@ddgu.edu` | Same as above |
| Admin | `admin@ddgu.edu` | Approve/reject requests, resolve conflicts, manage all bookings |

The login form is prefilled with the student demo account. Use the role cards to quickly
switch between student, faculty, and admin during a demo.

---

## Features

### Campus map
- The supplied **IET** and **Deeksha Bhawan** map images displayed together, uncropped and at their original aspect ratios.
- Independent **zoom in / zoom out / reset** controls for each map (50%–400%), with scrolling to explore the detail.
- “Open full image” links to the untouched source PNG.
- Building tabs still open the interactive room finder for schedules and bookings.
- Rooms are keyboard accessible (Tab + Enter/Space) in the room finder.

### Booking workflow
- Students submit **pending** requests; faculty/admin bookings are confirmed immediately.
- Admins review requests in the **Admin Panel** with one-click approve/reject.
- Double-booking is blocked by a conflict check across date, slot, and room.
- Users can cancel their own upcoming bookings (with confirmation).
- My Schedule shows upcoming and past bookings with status filters.

### Campus tools
- Dashboard with today's agenda, stats, quick actions, and a mini campus map.
- Room directory with search, building/type filters, capacity, equipment, and features.
- Announcements with unread badges and per-announcement read state.
- Conflict reporting and admin resolution queue.
- Notification and profile menus, toast feedback, and responsive mobile layout.

### Data & persistence
All demo data lives in `js/data.js`. User actions persist in `localStorage`:

| Key | Stores |
| --- | --- |
| `ddugu_session_v1` | Current signed-in user |
| `ddugu_bookings_v1` | Created / approved / cancelled bookings & conflicts |
| `ddugu_conflicts_v1` | Reported conflicts |
| `ddugu_read_announcements_v1` | Read announcement IDs |

To reset the demo, clear site data for the page (or run `localStorage.clear()` in DevTools
and reload). Seed bookings use dynamic today/tomorrow dates, so the demo always looks current.

---

## Project structure

```
ddugu-booking/
├── index.html       # Login screen + application shell
├── favicon.svg      # Campus/building icon
├── css/
│   └── styles.css   # Design system, layout, map & responsive styles
├── maps/
│   ├── iet-map.png
│   └── diksha-bhawan-map.png
└── js/
    ├── data.js      # Buildings, 15 rooms, users, slots, seed bookings, announcements
    └── app.js       # Auth, hash routing, dashboard, map, booking, admin logic
```

The map images are served at `/maps/iet-map.png` and `/maps/diksha-bhawan-map.png`.
They are byte-for-byte copies of the supplied files and are never modified or cropped.
To update a map later, replace the corresponding file in `ddugu-booking/maps/`.

### Buildings and rooms
- **IET** — 7 rooms across 3 floors (lecture halls, classrooms, labs).
- **Deeksha Bhawan** — 8 rooms across 3 floors (classrooms, physics lab, seminar room).

Room coordinates for the floor plans are stored alongside each room in `js/data.js`, so new
rooms can be added by appending an object with a `map` position and building/floor reference.

---

## Notes

- This is a front-end demo: authentication and storage are local to the browser.
- For production, replace the demo auth and `localStorage` layer with a real API/database.
- The UI uses the Inter font from Google Fonts when online; it falls back to system fonts offline.
