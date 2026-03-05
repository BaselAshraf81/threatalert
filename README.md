# ThreatAlert

**Suggested GitHub repo name: `sentinel-map`**

> Create on GitHub as: `github.com/YOUR_USERNAME/sentinel-map`

 🚨

A free, anonymous, community-driven Progressive Web App for real-time local incident awareness. No accounts, no ads, no data sold.

![ThreatAlert](public/placeholder-logo.svg)

## Features

- 🗺️ **Real-time Map**: Interactive map showing incidents in your area
- 🔒 **Anonymous**: No sign-up required, privacy-first design
- 👥 **Community-Validated**: Incidents surface after community verification
- 🔔 **Smart Notifications**: Push and Telegram alerts for your radius
- 📱 **PWA**: Install on any device, works offline
- 🌙 **Dark Mode**: Beautiful dark theme by default
- ⚡ **Fast**: Built with Next.js and Firebase

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: Radix UI, Tailwind CSS, Framer Motion
- **Map**: Leaflet with Stadia Maps tiles
- **Backend**: Firebase (Firestore, Functions, Hosting, FCM)
- **PWA**: Service Worker, Web App Manifest

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project (already configured: `threatalert-app-2026`)

### Installation

```bash
# Install dependencies
npm install

# Install function dependencies
cd functions && npm install && cd ..

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Firebase Setup

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

Quick start:
```bash
# Enable Firestore API
gcloud beta services mcp enable firestore.googleapis.com --project=threatalert-app-2026

# Create database
firebase firestore:databases:create "(default)" --location=us-east1

# Deploy everything
npm run build
firebase deploy
```

## Project Structure

```
threatalert/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with PWA setup
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── map-view.tsx      # Leaflet map with incidents
│   ├── report-sheet.tsx  # Incident reporting UI
│   ├── incident-detail-sheet.tsx
│   ├── notification-sheet.tsx
│   └── ui/               # Reusable UI components
├── lib/                   # Core logic
│   ├── firebase.ts       # Firebase initialization
│   ├── incidents-store.ts # Firestore integration
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # Utilities
├── hooks/                 # React hooks
│   ├── use-incidents.ts  # Incident management
│   └── use-app-state.tsx # Global app state
├── functions/             # Cloud Functions
│   └── src/
│       └── index.ts      # Vote processing, notifications
├── public/                # Static assets
│   ├── manifest.json     # PWA manifest
│   └── sw.js            # Service worker
├── firestore.rules       # Security rules
├── firestore.indexes.json # Database indexes
└── firebase.json         # Firebase configuration
```

## Incident Lifecycle

1. **Report**: User pins incident on map
2. **Pending**: Incident saved but not publicly visible
3. **Voting**: Community confirms or disputes
4. **Active**: Threshold met, incident shown prominently
5. **Notifications**: Subscribers in radius alerted
6. **Resolved**: Auto-expires or community resolves

## Categories

| Category | Icon | TTL | Threshold |
|----------|------|-----|-----------|
| Crime / Safety | 🔴 | 4h | 3 votes |
| Natural Disaster | 🟠 | 12h | 2 votes |
| Fire | 🔥 | 6h | 2 votes |
| Infrastructure | 🟡 | 8h | 3 votes |
| Civil Unrest | 🟣 | 6h | 4 votes |
| Custom | ⚪ | 4h | 5 votes |

## Security & Privacy

- **No accounts**: Anonymous by design
- **No tracking**: No analytics SDKs, no ads
- **Vote deduplication**: Device fingerprinting (localStorage)
- **Secure rules**: Firestore security rules prevent abuse
- **No PII**: Location never linked to identity

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Firebase Emulators

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Start Functions emulator
cd functions && npm run serve
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

Quick deploy:
```bash
npm run build
firebase deploy
```

## Contributing

This is a community project. Contributions welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] Photo uploads to Cloud Storage
- [ ] Telegram bot integration
- [ ] Geohashing for efficient radius queries
- [ ] Rate limiting and abuse prevention
- [ ] Custom domain setup
- [ ] Analytics (privacy-preserving)
- [ ] Multi-language support
- [ ] Incident categories customization

## Support

- 📧 Email: bosbos.basel@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/threatalert/issues)
- 📖 Docs: [DEPLOYMENT.md](DEPLOYMENT.md)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Maps by [Leaflet](https://leafletjs.com/) and [Stadia Maps](https://stadiamaps.com/)
- Hosted on [Firebase](https://firebase.google.com/)

---

Made with ❤️ for safer communities
