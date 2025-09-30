# Scripts de Backtest

## Scripts disponibles

### `npm run backtest:allocation`
Exécute le test d'allocation multi-symbole avec gestion du risque cross margin.

**Objectif :** 
- Capital initial : 1000 USDT
- Exposition cible : ~2500 USDT (levier effectif 2.5x)
- Buffer de marge libre : ~500 USDT

**Allocation des symboles :**
- IP/USDT (LONG_ONLY) : 50% => 1250 USDT
- PEOPLE/USDT (LONG/SHORT) : 30% => 750 USDT  
- AVNT/USDT (LONG/SHORT) : 10% => 250 USDT
- 0G/USDT (LONG/SHORT) : 10% => 250 USDT

**Paramètres :**
- Stop-loss : 22% de perte latente
- Sortie standard : signal inverse MACD
- Levier utilisé : 5x
- Frais maker : 0.02%
- Frais taker : 0.06%
- Slippage : 0.02%

**Sortie :**
- Résumé détaillé dans la console
- Fichier CSV `data/allocation_trades.csv` avec tous les trades

### `npm run backtest:allocation:tsnode`
Version alternative utilisant ts-node au lieu de tsx (fallback si tsx ne fonctionne pas).

### `npm run backtest:run`
Alias pour `npm run backtest:allocation` (script principal).

## Installation des dépendances

Si vous n'avez pas encore installé les dépendances :

```bash
npm install
```

## Exemples d'utilisation

```bash
# Exécuter le backtest d'allocation
npm run backtest:allocation

# Utiliser la version ts-node si tsx pose problème
npm run backtest:allocation:tsnode

# Alias rapide
npm run backtest:run
```

## Fichiers de sortie

Après exécution, vous trouverez :
- `data/allocation_trades.csv` : Détail de tous les trades effectués

## Notes

- Le script récupère les données en temps réel depuis Bitget
- La durée d'exécution dépend de la latence réseau et du nombre de symboles
- Les paramètres MACD sont configurés individuellement par symbole dans le code