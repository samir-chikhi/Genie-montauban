#!/usr/bin/env bash
# Installation globale des skills IA sur le poste de travail.
# Les skills deviennent disponibles dans TOUS les projets (genie-montauban.fr,
# c2fa.fr, et tous les dépôts GitHub) via Claude Code.
#
# Usage : bash install-skills.sh
# Prérequis : Node.js (npx). Les commandes fonctionnent aussi une par une
# dans un terminal Windows (PowerShell) ou macOS/Linux.
#
# Annuaire des skills : https://www.skills.sh/

set -e

# Méta-skill : permet à Claude de chercher et installer d'autres skills tout seul
npx -y skills add vercel-labs/skills -s find-skills -a claude-code -g -y

# Design et qualité visuelle des sites (pages HTML/CSS)
npx -y skills add anthropics/skills -s frontend-design -a claude-code -g -y
npx -y skills add vercel-labs/agent-skills -s web-design-guidelines -a claude-code -g -y

# Qualité web : SEO, accessibilité, performance (audits de pages)
npx -y skills add addyosmani/web-quality-skills -s seo -s accessibility -s performance -a claude-code -g -y

# Audit SEO marketing complet (mots-clés, contenu, maillage)
npx -y skills add coreyhaines31/marketingskills -s seo-audit -a claude-code -g -y

# Revue de code critique avant publication
npx -y skills add mattpocock/skills -s grill-me -a claude-code -g -y

# Baserow : gestion des bases de données (activités, adhérents, réservations)
npx -y skills add membranedev/application-skills -s baserow -a claude-code -g -y

echo ""
echo "Terminé. Vérifiez la liste avec : npx skills list -g"
