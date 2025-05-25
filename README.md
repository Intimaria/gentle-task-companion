# Gentle Task Companion 
## A gentle, privacy-focused task and mood companion app


## 💛 About this project

This app was created as a weekend self-care project to support mental health, especially for neurodivergent people like myself.  
It helps track tasks, moods, gratitude, and includes features like relaxing sounds and communication cards.  
I built it with accessibility and simplicity in mind.

If you'd like to contribute, offer feedback, or just try it — you're warmly invited.

If this project resonates and you'd like to support its development, even a small donation helps:

☕ [Donate via MercadoLibre](https://link.mercadopago.com.ar/intu)  
💸 [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=LJWDFCNPND8LG)


## RELEASE STATUS

####  Early Alpha/Beta — For Testing Only


This is an early, in-development version of Gentle Task Companion. Please be aware of the following:

- **Testing Phase:** This release is for testing and feedback. Features, data structures, and user experience may change at any time.
- **Limited Capacity:** The app is not yet production-ready. Data loss, bugs, and downtime are possible.
- **No Encryption:** All input text (tasks, mood, gratitude, crisis contacts, etc.) is stored as plain text in the database. There is currently no end-to-end encryption. Do not enter sensitive or private information.
- **Privacy:** While the app is designed to be privacy-focused, please use caution and review the code if you have concerns.
- **Technical Details:**
  - Built with Next.js, React, and Supabase for backend storage.
  - Data is stored per user (anonymous authentication is enabled) and grouped by local date.
  - No third-party analytics or tracking is included.
  - All user-facing strings are internationalized (English/Spanish).
  - The app is open source and licensed under the GNU GPL v3.

By using this app, you acknowledge the above limitations and risks. Feedback and contributions are welcome!
***



## Local Database Setup (for Testing)

This app was setup to connect to a Supabase instance and uses environment variables in Vercel to authorize the connection. 

In theory you can test locally with a self-hosted database instance, but this hasn't been tested by me. 

To try:

- Update your environment variables (e.g., `.env.local`) with the correct database connection string for your local instance.
- Make sure your database schema matches the app’s requirements (I exported the supabase project’s schema if that helps).
- Restart the development server after updating your environment variables.

Use docker for local testing:

```bash
docker run --name gentle-task-db -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres
```

### Running Schema Migrations 

If you want to apply the schema (`schema.sql`) to your local Postgres (e.g., running in Docker), use the following command (replace with your own values if different):


```sh
docker exec -i gentle-task-db psql -U postgres -d postgres < schema.sql
```

This will apply all schema changes to your local database. Make sure your container is running and `schema.sql` is in your current directory.


## Technology 

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

## Contributing, Feedback, and Community

Your feedback, ideas, and contributions are welcome! This project is meant to be gentle and collaborative. Whether you want to report a bug, suggest a feature, ask a question, or just say hello, you are invited to participate.

- **Open an Issue:** If something feels broken or confusing, feel free to [open an issue](https://github.com/your-repo-url/issues) on GitHub. Describe your problem or idea as clearly as you can. Screenshots and details are appreciated, but not required.  [open an issue]. I may not be able to reply quickly, but it helps me to know what’s working and what’s not.
- **Start a Discussion:** For open-ended questions, ideas, or to chat about the project, you can use the [Discussions](https://github.com/your-repo-url/discussions) tab. You are welcome here!
- **Translations:** If you’d like to help translate the app into another language, you can contribute by editing the translation files in `public/locales/`. New languages are more than welcome. Add a new folder (e.g., `fr/` for French) and a `common.json` file, or make suggestions to improve the existing translations.
- **Pull Requests:** If you want to contribute code, feel free to fork the repo and open a pull request. Please keep your changes small and focused, and add a description of what you’re improving.

No contribution is too small—typos, suggestions, and encouragement are all appreciated. This is a safe, welcoming space for all.



## Roadmap & Ideas

Here’s a gentle checklist of what’s done and what’s planned. If you have ideas or want to help, feel free to join in!

### Done
- [x] Tasks section with in progress support
- [x] Moods - UX friendly and with visual feedback
- [x] Gratitudes section
- [x] Crisis page and media
- [x] Use of external storage for media
- [x] Integrate Whatsapp and SMS support
- [x] History section for positive reinforcement
- [x] Communication cards
- [x] Tailwind CSS 
- [x] Favicon and PWA support
- [x] Database setup 
- [x] Internationalization (English/Spanish)
- [x] Date logic for daily tasks
- [x] About/support page improvements
- [x] Accesibility and UX focus

### Planned / Ideas
- [ ] Optional login for persistent accounts
- [ ] Client-side encryption for sensitive data
- [ ] More languages (translations welcome!)
- [ ] Improved accessibility and theming
- [ ] Add input for communication cards
- [ ] Improved functionality for save & retrieval of data
- [ ] Explore types of messages or notifications for positive reinforcement
- [ ] Periodic feedback
- [ ] Landing page
- [ ] Mobile-first UI refinements 
- [ ] Goblin type task breakdows
- [ ] Export/import data options
- [ ] ...and your suggestions!

---

## Contributors

<a href=https://github.com/Intimaria><img src="https://github.com/Intimaria.png" width="64" alt="Intimaria's avatar"></a>

Your feedback and kind thoughts are always welcome! This is a solo project made in a spirit of care. While I may not always respond quickly (or at all), I read everything and deeply appreciate encouragement, ideas, and gentle contributions.