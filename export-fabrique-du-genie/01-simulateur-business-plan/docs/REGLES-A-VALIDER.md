# Règles de calcul à faire valider

À relire avec l'expert-comptable partenaire avant toute ouverture au public. Tout est dans
`assets/js/engine.js`. Les valeurs ci-dessous sont **des paramètres d'exemple**, pas des règles établies.

| # | Règle actuelle | Pourquoi la valider | Où |
|---|---|---|---|
| 1 | Cotisations sociales = taux saisi × chiffre d'affaires (22 % par défaut) | Le calcul réel dépend du statut (micro, réel, société), de la rémunération et de l'ACRE | `calc`, champ `cotis` |
| 2 | Rémunération du porteur = montant mensuel saisi, charges incluses | À distinguer entre dirigeant assimilé salarié et indépendant | `calc`, champ `salaire` |
| 3 | TVA non modélisée (affichée mais sans effet) | Impact direct sur la trésorerie (décalage de TVA) | étape 6 |
| 4 | Aucun impôt sur le revenu ni sur les sociétés | Résultat présenté avant impôt | `calc` |
| 5 | Encaissements et décaissements le mois même | Pas de délais clients ni fournisseurs : le BFR est ignoré | `calc` |
| 6 | Investissements amortis sur 5 ans, en ligne droite | Durée à adapter par nature de bien | `AMORT_ANNEES` |
| 7 | Prêt à mensualités constantes, démarrage au mois 1, pas de différé | À confirmer selon l'offre bancaire | `calc` |
| 8 | Croissance des clients exponentielle jusqu'à un plafond | Hypothèse simple ; saisonnalité absente | `calc` |
| 9 | Scénarios : prudent (clients départ ×0,7, croissance ×0,6, prix ×0,95), ambitieux (×1,25, ×1,3, plafond ×1,2) | Écarts à valider avec le secteur | `scen` |
| 10 | Alertes : trésorerie fragile sous 2 000 €, apport faible sous 20 % de l'investissement, équilibre tardif après le mois 12 | Seuils à ajuster | `robustesse` |
| 11 | Score de robustesse : 100 moins des pénalités fixes | Pondération arbitraire, à présenter comme un repère | `robustesse` |
| 12 | Sensibilité : variation de ±10 % de chaque variable, effet sur la trésorerie de fin d'année 1 | Variables retenues à confirmer | `sensibilite` |

## Plan de validation proposé

1. Choisir 3 secteurs pilotes.
2. Réunir 10 à 15 porteurs de projet pour tester le parcours.
3. Faire recalculer 10 cas réels par l'expert-comptable et comparer avec l'outil.
4. Ajouter chaque cas validé comme test dans `tests/engine.test.js`.
5. Dater et figer les paramètres fiscaux et sociaux (année de référence affichée dans l'outil).
