# Job Board

A web application where people create an account, browse job advertisements, read the details and apply with the details saved in their profile. An administrator manages all the data and accepts or rejects applications.

- **Front end:** HTML, CSS (Bootstrap 5 + a small theme file) and plain JavaScript (`fetch`, no page reloads)
- **Back end:** Node.js + Express, a REST API
- **Database:** MySQL
- **Login:** sessions (a cookie holding a random id) and bcrypt password hashes

> For a full explanation of how the code works (what each file and function does, and where data is stored), read [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

---

## Features

**For users**
- Sign up, log in, log out
- "My profile" page: edit name, email, phone and password (these details are sent with every application)
- Job board: list of jobs with search, "Learn more" (full details loaded without reloading the page, no popup) and "Apply" (a message to the recruiter)
- A job you applied to disappears from your board, and you cannot apply twice
- "My applications" page: follow the status of each application (Pending, Accepted, Rejected)

**For the administrator**
- Admin page with one tab per table: list (paginated), create, edit and delete records
- Tables show names instead of ids, and forms use dropdowns
- Accept or reject applications. Accepting one removes the job from the database and rejects the other pending applications for it

---

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- [MySQL](https://dev.mysql.com/downloads/) 8 (MariaDB or XAMPP also work)
- An internet connection when using the site (Bootstrap and the Figtree font load from a CDN)

---

## Installation

**1. Get the code and install the packages**

```bash
git clone <your-repository-url>
cd job-board
npm install
```

`npm install` reads `package.json` and installs: `express`, `express-session`, `bcrypt`, `mysql2` and `dotenv`.

**2. Create the database**

Run `schema.sql`. It creates the `jobboard` database and the four tables.

```bash
mysql -u root -p < schema.sql
```

Or open `schema.sql` in MySQL Workbench and click the lightning bolt.

> Already have a database from an older version? Run `migration.sql` instead. It keeps your data.

**3. Configure the environment**

Copy `.env.example` to `.env` and fill it in (see [Configuration](#configuration)).

```bash
cp .env.example .env        # on Windows: copy .env.example .env
```

**4. Start the server**

```bash
node server.js
```

You should see `Running on http://localhost:3001`.

**5. Create the first administrator**

There is no "admin signup" on purpose. Instead:

1. Open http://localhost:3001 and click **Sign up**. Create your account.
2. Promote it in MySQL:

```sql
USE jobboard;
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

3. Log out and log in again. You are sent to the admin page (the role is read at login).

**6. Add some data**

On the admin page: add a **Company** first, then add **Jobs** (a job needs a company and an owner, chosen from dropdowns). Normal users can then see and apply to those jobs.

---

## Configuration

All settings are in the `.env` file at the root of the project. This file holds secrets and is **not** uploaded to GitHub (it is listed in `.gitignore`).

| Key | Meaning | Example |
|---|---|---|
| `DB_HOST` | Where MySQL runs | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password (empty with a default XAMPP install) | `my-password` |
| `DB_NAME` | Database name | `jobboard` |
| `SESSION_SECRET` | Long random text used to sign the login cookie | `k3j9...random` |

- The `.env` file is read only when the server starts. After changing it, stop the server (`Ctrl+C`) and start it again.
- The port is `3001`. To change it, edit the last line of `server.js` (`app.listen(3001, ...)`).

---

## Running

```bash
node server.js
```

| Address | What you see |
|---|---|
| http://localhost:3001 | The job board (you are sent to the login page if you are logged out) |
| http://localhost:3001/login.html | Login |
| http://localhost:3001/admin.html | Administration (admins only) |

Always open the site through this address. Opening the HTML files directly, or with a "Live Server" extension, will not work because the API lives on the Express server.

---

## Project structure

```
job-board/
├── server.js            Express server: all the API routes and access rules
├── database.js          MySQL connection pool (reads the .env settings)
├── schema.sql           Creates the database and tables (new install)
├── migration.sql        Updates an older database to the current schema
├── package.json         Project info and the list of packages
├── .env                 Your settings and secrets (not on GitHub)
├── .env.example         Template of the .env file
├── .gitignore           Files git must ignore (.env, node_modules)
├── README.md            This file
├── HOW_IT_WORKS.md      Detailed explanation of the code
└── public/
    ├── html/            The pages
    │   ├── index.html          Job board
    │   ├── login.html          Login
    │   ├── signup.html         Sign up
    │   ├── profile.html        My profile
    │   ├── applications.html   My applications
    │   └── admin.html          Administration
    ├── css/
    │   └── style.css    Theme: Bootstrap colors, font, small extras
    └── js/
        ├── common.js          Shared helpers (navbar, alerts, dates)
        ├── script.js          Job board page
        ├── applications.js    My applications page
        ├── profile.js         My profile page
        ├── login.js           Login page
        ├── signup.js          Sign up page
        └── admin.js           Administration page
```

---

## Database schema

Four tables. The table `ads` is called "jobs" in the interface.

```
companies 1 ───< ads >─── 1 users          (a job has one company and one owner)
                  1
                  │
                  ^
              applications >─── 1 users    (an application links a user to a job)
```

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | INT, primary key, auto increment | |
| `name` | VARCHAR(100), required | |
| `email` | VARCHAR(150), required, **unique** | Used to log in |
| `phone` | VARCHAR(30) | Optional |
| `password_hash` | VARCHAR(255), nullable | bcrypt hash, never the real password |
| `role` | ENUM('user','admin'), default `user` | Decides where login redirects and who can use the admin page |
| `created_at` | TIMESTAMP | Set automatically |

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | INT, primary key, auto increment | |
| `name` | VARCHAR(150), required | |
| `website` | VARCHAR(255) | |
| `location` | VARCHAR(150) | |

### `ads` (jobs)

| Column | Type | Notes |
|---|---|---|
| `id` | INT, primary key, auto increment | |
| `title` | VARCHAR(150), required | |
| `short_description` | VARCHAR(255), required | Shown in the list |
| `full_description` | TEXT, required | Shown by "Learn more" |
| `wage` | VARCHAR(50) | Text such as "2500 EUR/month" |
| `location` | VARCHAR(150) | |
| `working_time` | VARCHAR(50) | Such as "Full-time" |
| `company_id` | INT, required | Foreign key to `companies.id` |
| `owner_id` | INT, required | Foreign key to `users.id` (the person in charge of the ad) |
| `created_at` | TIMESTAMP | Newest jobs are listed first |

### `applications`

| Column | Type | Notes |
|---|---|---|
| `id` | INT, primary key, auto increment | |
| `ad_id` | INT, **nullable** | Foreign key to `ads.id` (`ON DELETE CASCADE`). Becomes `NULL` when the job is filled and deleted |
| `ad_title` | VARCHAR(150), nullable | Copy of the job title, saved when the job is deleted so users still see what they applied to |
| `company_name` | VARCHAR(150), nullable | Same, for the company |
| `user_id` | INT, required | Foreign key to `users.id` (`ON DELETE CASCADE`) |
| `message` | TEXT, required | The message to the recruiter |
| `status` | ENUM('pending','accepted','rejected'), default `pending` | Changed only by the admin accept/reject route |
| `created_at` | TIMESTAMP | |

**Unique key** `(user_id, ad_id)`: the database itself refuses a second application from the same user to the same job.

---

## API routes

Every route returns JSON. Errors look like `{ "error": "message" }`.
**Access:** *public* = anyone, *login* = logged-in user, *admin* = logged-in admin.

### Account

| Method | Route | Access | What it does | Status codes |
|---|---|---|---|---|
| POST | `/api/signup` | public | Create an account and log in. Body: `name, email, phone, password` | 201, 400 missing field, 409 email used |
| POST | `/api/login` | public | Log in. Body: `email, password`. Returns `{ role }` | 200, 400, 401 wrong email or password |
| POST | `/api/logout` | public | Destroy the session | 200 |
| GET | `/api/me` | login | The logged-in user's details (`id, name, email, phone, role`) | 200, 401 |
| PUT | `/api/me` | login | Edit own profile. Body: `name, email, phone, password` (empty password keeps the old one) | 200, 400, 401, 409 email used |
| GET | `/api/me/applications` | login | The user's applications with job title, company, message, status, date | 200, 401 |

### Jobs and applications (users)

| Method | Route | Access | What it does | Status codes |
|---|---|---|---|---|
| GET | `/api/ads` | login | Jobs the user has **not** applied to yet (with company, location, wage, working time) | 200, 401 |
| GET | `/api/ads/:id` | login | Full information about one job | 200, 401, 404 |
| POST | `/api/ads/:id/applications` | login | Apply to a job. Body: `message`. The applicant is the logged-in user | 201, 400 no message, 401, 404, 409 already applied |

### Administration

`:table` is one of `users`, `companies`, `ads`, `applications`.

| Method | Route | Access | What it does | Status codes |
|---|---|---|---|---|
| GET | `/api/admin/:table?page=1&limit=10` | admin | Paginated list with names instead of ids. Returns `{ rows, total, page, pages }` (limit is at most 100) | 200, 401, 403, 404 |
| POST | `/api/admin/:table` | admin | Create a record. Returns `{ id }` | 201, 400 |
| PUT | `/api/admin/:table/:id` | admin | Update a record | 200, 400, 404 |
| DELETE | `/api/admin/:table/:id` | admin | Delete a record | 200, 400, 404 |
| PATCH | `/api/admin/applications/:id` | admin | Accept or reject. Body: `{ "status": "accepted" }` or `"rejected"` | 200, 400, 404, 409 already decided, 500 |
| GET | `/api/admin/lookup/:name` | admin | Dropdown lists (`users`, `companies`, `ads`) as `[{ id, label }]` | 200, 401, 403, 404 |

**Accepting an application** runs in one database transaction (all steps or none):
1. the application becomes `accepted`;
2. the other pending applications for the same job become `rejected`;
3. the job title and company are copied onto the applications;
4. the applications are detached from the job (`ad_id = NULL`);
5. the job is deleted.

**Rejecting** only changes the status. A decision is final.

---

## Pages

| URL | File | Access | Purpose |
|---|---|---|---|
| `/` (and `/index.html`) | `public/html/index.html` | login | Job board: search, "Learn more", "Apply" |
| `/login.html` | `public/html/login.html` | public | Log in. Admins are redirected to `/admin.html`, other users to `/` |
| `/signup.html` | `public/html/signup.html` | public | Create an account |
| `/profile.html` | `public/html/profile.html` | login | Edit the personal details used to apply |
| `/applications.html` | `public/html/applications.html` | login | Status of each application |
| `/admin.html` | `public/html/admin.html` | admin | Manage all the tables, accept or reject applications |

Pages that need a login redirect to `/login.html` when you are logged out. A logged-in user who opens `/admin.html` is sent back to `/`.

---

## Security notes

- Passwords are hashed with bcrypt. The real password is never stored.
- All SQL uses placeholders (`?`), so user input cannot change a query (no SQL injection).
- The admin routes check the role on the server, not only in the browser.
- Admin routes accept only a fixed list of tables and columns.
- Text from the database is inserted with `textContent`, never as HTML (no XSS).
- The login cookie is set by `express-session`. Nothing is stored in `localStorage`.

**Known limits** (fine for local use): sessions are kept in the server's memory, so everyone is logged out when the server restarts. For a real deployment you would add HTTPS, a persistent session store, login rate limiting and stronger input validation.

---

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `Access denied for user 'root'@'localhost'` | Wrong `DB_USER` or `DB_PASSWORD` in `.env`, or `.env` was not read (check its name and location, then restart) |
| `Unknown database 'jobboard'` / table doesn't exist | `schema.sql` was not run |
| `ECONNREFUSED` | MySQL is not running |
| `EADDRINUSE` | Port 3001 is used by another program, often an old copy of this server |
| `Cannot find module './database'` | The file name in `require("./database")` must match the file |
| "Unexpected token '<'... is not valid JSON" | The page was not opened through `http://localhost:3001` |
| Logged out after restarting the server | Normal: sessions are stored in memory |
| Still redirected to login after promoting yourself | Log out and log in again; the role is read at login |
