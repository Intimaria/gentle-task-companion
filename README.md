# Gentle Task Companion 
## A gentle, privacy-focused task and mood companion app


## 💛 About this project

This app was created as a weekend self-care project to support mental health, especially for neurodivergent people like myself.  
It helps track tasks, moods, gratitude, and includes features like relaxing sounds, communication cards, and emotional support animals.  
I built it with accessibility and simplicity in mind.

In 2026 it was redesigned as part of the **Cloud Architecture course** by [AWS Women in Cloud Buenos Aires](https://www.meetup.com/aws-women-in-cloud-buenos-aires/), migrating to a serverless AWS architecture while keeping a fully self-hosted option.

If you'd like to contribute, offer feedback, or just try it — you're warmly invited.

If this project resonates and you'd like to support its development, even a small donation helps:

☕ [Donate via MercadoLibre](https://link.mercadopago.com.ar/intu)  
💸 [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=LJWDFCNPND8LG)


## RELEASE STATUS

#### Beta — Functional but evolving


This is an early release of Gentle Task Companion. Please be aware of the following:

- **Testing Phase:** This release is for testing and feedback. Features, data structures, and user experience may change at any time.
- **Limited Capacity:** The app is not yet production-ready. Data loss, bugs, and downtime are possible.
- **Encryption:** Data is encrypted at rest (DynamoDB SSE, S3 SSE) and in transit (HTTPS). There is no client-side (end-to-end) encryption — the service operator can read stored data. Do not enter information you consider truly sensitive.
- **Privacy:** No third-party analytics or tracking is included. If you self-host, you control your own data entirely.
- **Technical Details:**
  - Built with Hono (Node.js backend), Next.js (frontend), DynamoDB, S3, and Cognito on AWS.
  - Data is stored per authenticated user and grouped by local date.
  - No third-party analytics or tracking is included.
  - All user-facing strings are internationalized (English/Spanish).
  - The app is open source and licensed under the PolyForm Noncommercial License 1.0.0.

By using this app, you acknowledge the above limitations and risks. Feedback and contributions are welcome!
***



## Running locally

### Self-hosted (Docker)

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (PWA) | http://localhost:3000 |
| Backend (API) | http://localhost:8080 |
| OIDC (mock) | http://localhost:8081 |
| MinIO (console) | http://localhost:9001 |

Login via mock-oidc: any username works. Table and bucket are created automatically on startup.

```bash
docker compose down
```

### AWS-emulated (MiniStack + OpenTofu)

Runs the same backend against emulated AWS services. Full instructions in [`infra/aws/README.md`](./infra/aws/README.md). In short:

```bash
docker compose -f docker-compose.aws.yml up -d ministack

cd infra/aws
direnv allow
npm --prefix ../../backend run build:lambda \
  && rm -f lambda.zip && (cd ../../backend/dist/lambda && zip -qr "$OLDPWD/lambda.zip" .)
tofu init && tofu apply
./smoke.sh

eval "$(./frontend-env.sh)"
docker compose -f ../../docker-compose.aws.yml --profile frontend up -d --build frontend
```

Open http://localhost:3000 and log in via the Cognito Hosted UI (user `admin`, password `Passw0rd!`, created by the smoke script).


## Technology 

| Layer | Self-hosted | AWS |
|---|---|---|
| Frontend | Next.js 15 (PWA) | Next.js 15 (PWA) |
| Backend | Hono (Node) in Docker | Hono (Node) in Lambda |
| Auth | mock-oidc | Cognito |
| Database | ScyllaDB | DynamoDB |
| Storage | MinIO | S3 |
| IaC | docker compose | OpenTofu |


## Contributing, Feedback, and Community

Your feedback, ideas, and contributions are welcome! This project is meant to be gentle and collaborative. Whether you want to report a bug, suggest a feature, ask a question, or just say hello, you are invited to participate.

- **Open an Issue:** If something feels broken or confusing, feel free to [open an issue](https://github.com/Intimaria/gentle-task-companion/issues) on GitHub. Describe your problem or idea as clearly as you can. Screenshots and details are appreciated, but not required. I may not be able to reply quickly, but it helps me to know what's working and what's not.
- **Start a Discussion:** For open-ended questions, ideas, or to chat about the project, you can use the [Discussions](https://github.com/Intimaria/gentle-task-companion/discussions) tab. You are welcome here!
- **Translations:** If you'd like to help translate the app into another language, you can contribute by editing the translation files in `frontend/public/locales/`. New languages are more than welcome. Add a new folder (e.g., `fr/` for French) and a `common.json` file, or make suggestions to improve the existing translations.
- **Pull Requests:** If you want to contribute code, feel free to fork the repo and open a pull request. Please keep your changes small and focused, and add a description of what you're improving.

No contribution is too small—typos, suggestions, and encouragement are all appreciated. This is a safe, welcoming space for all.



## Roadmap & Ideas

Here's a gentle checklist of what's done and what's planned. If you have ideas or want to help, feel free to join in!

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
- [x] Login with persistent accounts (OIDC / Cognito)
- [x] Animal companion with favorites (cats, dogs, capybaras)
- [x] Serverless AWS architecture (Lambda, API GW, DynamoDB, S3, Cognito)

### Planned / Ideas
- [ ] More languages (translations welcome!)
- [ ] Improved accessibility and theming
- [ ] Add input for communication cards
- [ ] Improved functionality for save & retrieval of data
- [ ] Explore types of messages or notifications for positive reinforcement
- [ ] Periodic feedback
- [ ] Landing page
- [ ] Mobile-first UI refinements 
- [ ] Goblin type task breakdowns
- [ ] Export/import data options
- [ ] ...and your suggestions!

---

## Contributors

<a href=https://github.com/Intimaria><img src="https://github.com/Intimaria.png" width="64" alt="Intimaria's avatar"></a>

Your feedback and kind thoughts are always welcome! This is a solo project made in a spirit of care. While I may not always respond quickly (or at all), I read everything and deeply appreciate encouragement, ideas, and gentle contributions.

---

## License

[PolyForm Noncommercial License 1.0.0](./LICENCE.md) — free for personal, educational, and non-profit use.
