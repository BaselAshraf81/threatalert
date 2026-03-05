# ThreatAlert

A free, anonymous, community-driven Progressive Web App for real-time local incident awareness. No accounts, no ads, no data sold.

## Features

- 🗺️ **Interactive Map** - Real-time incident visualization with Leaflet and Stadia Maps
- 🔒 **Anonymous & Privacy-First** - No sign-up, no tracking, no PII collection
- 👥 **Community Validation** - Incidents surface after community verification via voting
- 🔔 **Smart Alerts** - Push notifications with customizable radius (1-25km) and worldwide option
- ⚠️ **Unverified Threat Alerts** - Optional notifications for pending incidents before verification
- 📱 **Progressive Web App** - Install on any device, works offline
- 🌙 **Dark Mode** - Beautiful dark theme by default
- ⚡ **Fast & Modern** - Built with Next.js 16, React 19, TypeScript

## Incident Categories

| Category | TTL | Verification Threshold |
|----------|-----|------------------------|
| Crime / Safety | 4h | 3 votes |
| Natural Disaster | 12h | 2 votes |
| Fire | 6h | 2 votes |
| Infrastructure | 8h | 3 votes |
| Civil Unrest | 6h | 4 votes |
| Other | 4h | 5 votes |

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Framer Motion
- **Map**: Leaflet with react-leaflet
- **Backend**: Firebase (Firestore, Cloud Functions, FCM)
- **Deployment**: Firebase Hosting, Netlify

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### Installation

```bash
# Install dependencies
npm install

# Install function dependencies
cd functions && npm install && cd ..

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Firebase config

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Firebase Setup

```bash
# Login to Firebase
firebase login

# Enable Firestore
firebase firestore:databases:create "(default)" --location=us-east1

# Deploy
npm run build
firebase deploy
```

## Project Structure

```
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── map-view.tsx       # Leaflet map with incidents
│   ├── report-sheet.tsx   # Incident reporting UI
│   └── ui/                # Radix UI components
├── lib/                    # Core logic
│   ├── firebase.ts        # Firebase initialization
│   ├── incidents-store.ts # Firestore integration
│   └── types.ts           # TypeScript types
├── hooks/                  # React hooks
├── functions/              # Cloud Functions
│   └── src/index.ts       # Vote processing, notifications
└── public/                 # Static assets & PWA files
```

## How It Works

1. **Report** - User pins incident on map with category and description
2. **Pending** - Incident saved but not publicly visible
3. **Voting** - Community confirms or disputes the incident
4. **Active** - Once threshold is met, incident becomes visible to all
5. **Notifications** - Subscribers within radius receive push alerts
6. **Resolved** - Auto-expires based on TTL or community resolution

## Security & Privacy

- **No accounts** - Fully anonymous by design
- **No tracking** - No analytics SDKs or ads
- **Vote deduplication** - IP-based (hashed) to prevent abuse
- **Rate limiting** - Server-side protection against spam
- **Secure Firestore rules** - Prevent unauthorized access
- **No PII** - Location never linked to identity

## Roadmap

- [ ] Telegram bot integration for alerts
- [ ] Geohashing for efficient radius queries
- [ ] Enhanced rate limiting and abuse prevention
- [ ] Multi-language support
- [ ] Custom domain setup
- [ ] Privacy-preserving analytics

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Deploy to Firebase
firebase deploy

# Deploy to Netlify
netlify deploy --prod
```

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and submit a pull request.

## License

MIT License

## Contact

📧 bosbos.basel@gmail.com

---

Made with ❤️ for safer communities
