# 🤖 Système de Trading Automatisé MACD - Netlify

Ce système de trading automatisé utilise des fonctions serverless Netlify pour exécuter des stratégies MACD sur 4 cryptomonnaies différentes.

## 📁 Structure des Fichiers

```
netlify/
├── app/
│   └── trading/
│       ├── config.ts          # Configuration des paramètres de trading
│       ├── trader.ts          # Logique principale de trading
│       └── bitget-utils.ts    # Utilitaires pour l'API Bitget
└── functions/
    ├── trading-ip/
    │   └── trading-ip.mts     # Fonction serverless pour IP/USDT
    ├── trading-people/
    │   └── trading-people.mts # Fonction serverless pour PEOPLE/USDT
    ├── trading-avnt/
    │   └── trading-avnt.mts   # Fonction serverless pour AVNT/USDT
    └── trading-0g/
        └── trading-0g.mts     # Fonction serverless pour 0G/USDT
```

## ⚙️ Configuration

### Variables d'environnement requises

Dans l'interface Netlify, configurez les variables d'environnement suivantes :

```env
BITGET_API_KEY=your_api_key_here
BITGET_SECRET=your_secret_here
BITGET_PASSPHRASE=your_passphrase_here
NODE_ENV=production
```

### Configuration des cryptomonnaies

Le fichier `config.ts` contient la configuration pour chaque crypto :

```typescript
export const TARGET_EXPOSURES: Record<string, SymbolConfig> = {
  "IP/USDT:USDT": { 
    symbol: "IP/USDT:USDT", 
    notional: 1250,      // Exposition cible en USDT
    mode: "LONG_ONLY",   // Mode de trading
    allocation: 0.5,     // 50% de l'allocation
    fast: 16,           // Période EMA rapide
    slow: 26,           // Période EMA lente
    signal: 7           // Période de signal
  },
  // ... autres configurations
};
```

## 🚀 Fonctionnement

### Stratégie MACD

1. **Calcul des indicateurs** : EMA rapide, EMA lente, ligne MACD et signal
2. **Détection des signaux** :
   - **Signal BULL** : MACD croise au-dessus du signal → Position LONG
   - **Signal BEAR** : MACD croise en-dessous du signal → Position SHORT (si autorisé)
3. **Gestion des risques** :
   - Stop-loss à 22% de perte
   - Levier de 5x
   - Calcul automatique des tailles de position

### Modes de trading

- **LONG_ONLY** : Seulement des positions longues (IP, AVNT, 0G)
- **LONG_SHORT** : Positions longues et courtes (PEOPLE)

### Exécution automatique

Chaque fonction serverless s'exécute **toutes les heures** (cron: `0 * * * *`) et :

1. Récupère les données de marché via l'API Bitget
2. Calcule les indicateurs MACD
3. Détecte les signaux de trading
4. Gère les positions existantes (stop-loss, signaux inverses)
5. Ouvre de nouvelles positions si nécessaire
6. Log les résultats et l'état du compte

## 💰 Gestion du Capital

Le système récupère automatiquement :
- Le capital disponible depuis Bitget
- Les positions ouvertes
- Les frais de trading actuels
- Le statut de santé du compte

### Calculs de position

```typescript
// Marge requise = Exposition cible / Levier
const marginRequired = targetNotional / LEVERAGE;

// Vérifications de sécurité
if (marginRequired > availableBalance) {
  // Position refusée - balance insuffisante
}
```

## 📊 Monitoring

### Logs disponibles

- État du compte Bitget (capital, marge utilisée, PnL latent)
- Signaux MACD détectés
- Positions ouvertes/fermées
- Résultats des trades
- Alertes de santé du compte

### Exemple de log

```
🚀 Démarrage trading pour IP/USDT:USDT
📊 ==> STATUT DU COMPTE BITGET <==
💰 Capital total: 1000.00 USDT
💵 Capital disponible: 750.00 USDT
🔒 Marge utilisée: 250.00 USDT
🆓 Marge libre: 750.00 USDT
📈 PnL latent: 15.50 USDT
🏥 Santé du compte: ✅ SAIN
📊 Ratio de marge: 25.0%
📊 IP/USDT:USDT: Prix=0.0825, Signal=BULL, Position=NONE
📈 Position LONG ouverte pour IP/USDT:USDT
✅ Aucune action requise pour IP/USDT:USDT
```

## 🔧 Déploiement

1. **Configurez les variables d'environnement** dans Netlify
2. **Déployez le code** - les fonctions seront automatiquement découvertes
3. **Vérifiez les crons** - ils s'exécuteront selon la planification dans `netlify.toml`

### Test des fonctions

Vous pouvez tester manuellement chaque fonction via les URLs :
- `/.netlify/functions/trading-ip`
- `/.netlify/functions/trading-people`  
- `/.netlify/functions/trading-avnt`
- `/.netlify/functions/trading-0g`

## ⚠️ Alertes de Sécurité

Le système inclut plusieurs mécanismes de protection :

1. **Vérification de la marge** avant chaque trade
2. **Stop-loss automatique** à 22%
3. **Contrôle de santé du compte**
4. **Limitations de taille de position**
5. **Gestion d'erreurs complète**

## 📈 Allocation des Fonds

- **IP/USDT** : 50% (1250 USDT) - LONG seulement
- **PEOPLE/USDT** : 30% (750 USDT) - LONG/SHORT
- **AVNT/USDT** : 10% (250 USDT) - LONG seulement  
- **0G/USDT** : 10% (250 USDT) - LONG seulement

**Total exposition** : 2500 USDT avec levier 5x = 500 USDT de marge utilisée
**Buffer de sécurité** : 500 USDT de marge libre

---

⚡ **Système opérationnel 24/7** avec exécution automatique toutes les heures !