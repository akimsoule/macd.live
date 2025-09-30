# MACD Live - Trading Dashboard

## Description

Système de Trading Automatisé basé sur l'indicateur MACD avec dashboard en temps réel.

## Fonctionnalités

- Dashboard de trading en temps réel
- Authentification sécurisée
- Métriques de performance
- Graphiques interactifs
- Gestion des positions automatisée

## Installation et Développement

Pour travailler en local avec votre IDE préféré :

Prérequis : Node.js & npm installés - [installer avec nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Étapes :

```sh
# Étape 1: Cloner le repository
git clone <YOUR_GIT_URL>

# Étape 2: Naviguer vers le dossier du projet
cd macd-live

# Étape 3: Installer les dépendances
npm i

# Étape 4: Démarrer le serveur de développement
npm run dev
```

## Variables d'environnement

Copiez `.env.example` vers `.env` et configurez :

```bash
# Authentification
DASHBOARD_USER=votre@email.com
DASHBOARD_PASSWORD=votre_mot_de_passe
JWT_SECRET=votre_jwt_secret

# Base de données
DATABASE_URL=postgresql://...

# Trading API
ACCOUNT_API_KEY_MAIN=...
ACCOUNT_SECRET_KEY_MAIN=...
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Netlify Functions
- **Base de données**: PostgreSQL + Prisma
- **Trading**: API Bitget
- **Authentification**: JWT

## Déploiement

Le projet est configuré pour le déploiement automatique sur Netlify.

## Configuration du trading

Les symboles et paramètres MACD sont configurés dans `netlify/app/trading/config.ts`.

## Documentation

- **Backtests** : `docs/BACKTEST.md` - Guide complet des scripts de backtest
- **Données** : `data/` - Fichiers CSV générés par les backtests

## Licence

Usage privé uniquement.
