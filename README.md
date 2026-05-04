# Approval Center – Easy Guide (English)

Static site explaining, in very simple terms, the unified approval flow (vacations, purchasing, scrap, etc.).

It also includes `distribucion-maquinas.html`, a browser-only tool that can now persist full working snapshots in Supabase.

## Files
- `index.html`, `styles.css`, `script.js`
- `distribucion-maquinas.html` for machine/group balancing
- `.nojekyll` to serve without Jekyll

## Supabase Persistence for `distribucion-maquinas.html`

The page is still static HTML, but it can save/load the full app state directly from Supabase using the public anon key.

### 1. Create the table

Run this SQL in Supabase, or use [supabase/machine_distribution_snapshots.sql](/c:/Users/cesar.araiza/wampresentation/supabase/machine_distribution_snapshots.sql):

```sql
create table if not exists public.machine_distribution_snapshots (
	project_key text primary key,
	title text not null,
	payload jsonb not null,
	updated_at timestamptz not null default timezone('utc', now())
);
```

### 2. Enable access for the static page

If this is an internal/trusted tool and you are not using authentication yet, the minimal setup is:

```sql
alter table public.machine_distribution_snapshots enable row level security;

create policy "anon can read machine snapshots"
on public.machine_distribution_snapshots
for select
to anon
using (true);

create policy "anon can insert machine snapshots"
on public.machine_distribution_snapshots
for insert
to anon
with check (true);

create policy "anon can update machine snapshots"
on public.machine_distribution_snapshots
for update
to anon
using (true)
with check (true);

create policy "anon can delete machine snapshots"
on public.machine_distribution_snapshots
for delete
to anon
using (true);
```

This is convenient, but not secure for a public internet app. For production/multi-user usage, add Supabase Auth and restrict policies by authenticated user or organization.

### 3. Fill the connection fields in the page

Open `distribucion-maquinas.html` and provide:

1. Supabase URL
2. Public anon key
3. Project name/key (example: `reparto-planta-a`)

Then use:

1. `Validar conexión`
2. `Guardar nube`
3. `Cargar nube`

Optional:

1. Enable `Autoguardar cambios`
2. Enable `Intentar cargar al abrir`

The page stores only the Supabase connection settings in the browser. The actual people/machines/groups data is stored in Supabase.

## Publish on GitHub Pages

1. Ensure these files are in the `main` branch root.
2. In GitHub: Settings → Pages.
3. Source: Deploy from a branch.
4. Branch: `main`, Folder: `/ (root)`.
5. Save → Wait ~1–3 minutes.
6. Site URL: `https://wamx01.github.io/wampresentation/`.

## Local Preview
Just open `index.html` in a browser.

## Custom Domain (Optional)
Add a `CNAME` file with your domain and create a DNS CNAME to `wamx01.github.io`.
