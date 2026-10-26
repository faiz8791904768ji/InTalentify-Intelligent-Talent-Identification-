# InTalentify

**Talent beyond the usual campuses.** InTalentify is a full-stack, role-based placement-platform MVP that helps students from Tier-3 colleges showcase skills, projects, and academic achievements to recruiters.

## Included

- Separate student and employer registration/login
- Role-based dashboards
- Employer job posting and candidate inbox
- Student job discovery, search, profile editing, and applications
- File-backed database with sample jobs, password hashing, and token sessions
- Responsive landing page and filterable talent-discovery grid

## Run locally

Requires Node.js 18+ (no `npm install` necessary):

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000). The first start automatically creates `data.json`, the local development database.

## Next steps for a production version

1. Move the data store from JSON to PostgreSQL or MongoDB.
2. Add email verification, password reset, and persistent session storage.
3. Add project uploads, resume parsing, saved jobs, shortlists, and application status changes.
4. Implement a transparent talent-score model based on verified skills, projects, and activity.

## Tech

Node.js, HTML, CSS, and vanilla JavaScript.
