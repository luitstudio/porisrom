# @porishrom/database

The single Prisma schema for the whole system, targeting Postgres. Only `apps/backend` imports this package — `apps/frontend` and `apps/admin` never touch the database directly, they call the backend's API.

Currently mirrors the `User` model that `apps/frontend` still manages locally (SQLite) during the migration period. Will be expanded with `Profile`, `Job`, `JobApplication`, `Conversation`/`Message`, `PortfolioItem`, `Review`, `Category`/`Skill` as those features are built.

`apps/frontend` keeps its own local SQLite Prisma setup temporarily and remains fully functional standalone until the backend's auth module exists and the frontend is rewired to call it instead (see project roadmap).
