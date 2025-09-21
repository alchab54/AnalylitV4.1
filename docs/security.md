# 🔐 SECURITY.md - Politique de Sécurité

## 🛡️ **Signalement de Vulnérabilités**

La sécurité d'AnalyLit v4.1 est notre priorité absolue. Si vous découvrez une vulnérabilité de sécurité, nous vous demandons de la signaler de manière responsable.

### **📧 Contact Sécurité**
- **Email** : alicechabaux@gmail.com
- **Objet** : `[SECURITY] Vulnérabilité AnalyLit v4.1`
- **Réponse** : Sous 48h maximum

### **🚨 Processus de Signalement**

1. **NE PAS** créer d'issue publique sur GitHub
2. **Envoyer** un email détaillé avec :
   - Description de la vulnérabilité
   - Étapes pour la reproduire
   - Impact potentiel
   - Version affectée
3. **Attendre** notre réponse avant divulgation publique
4. **Collaborer** avec nous pour la correction

---

## 🏆 **Mesures de Sécurité Implémentées**

### **🔐 Protection des Données**
- ✅ **Chiffrement** : HTTPS obligatoire en production
- ✅ **Base de données** : Connexions chiffrées PostgreSQL
- ✅ **Secrets** : Variables d'environnement sécurisées
- ✅ **Sessions** : Gestion sécurisée des tokens JWT

### **🛡️ Protection des Entrées**
- ✅ **Validation** : Sanitisation de toutes les entrées utilisateur
- ✅ **Injection SQL** : ORM SQLAlchemy avec requêtes paramétrées
- ✅ **XSS** : Échappement automatique des données affichées
- ✅ **CSRF** : Protection cross-site request forgery

### **⚡ Limites de Taux**
- ✅ **Rate limiting** : 100 requêtes/minute par utilisateur
- ✅ **Upload limits** : 50MB maximum par fichier
- ✅ **Timeout** : Limite de 30 minutes par tâche IA

### **🔍 Audit Automatique**
- ✅ **Tests sécurité** : 5 tests automatisés dans la suite
- ✅ **Dépendances** : Scan automatique des vulnérabilités
- ✅ **Docker** : Images officielles, mise à jour régulière

---

## 🎯 **Périmètre de Sécurité**

### **✅ Couvert par cette Politique**
- Application web AnalyLit v4.1
- API REST et endpoints
- Images Docker et configuration
- Scripts de déploiement
- Documentation et guides

### **❌ Hors Périmètre**
- Services tiers (Ollama, bases de données externes)
- Infrastructure AWS utilisée pour déploiement
- Extensions browser ou plugins

---

## 📋 **Versions Supportées**

| Version | Support Sécurité | Status |
|---------|------------------|---------|
| 4.1.x   | ✅ Support complet | Actuelle |
| 4.0.x   | ⚠️ Support limité | Obsolète |
| < 4.0   | ❌ Non supporté | EOL |

---

## 🏅 **Bonnes Pratiques pour Utilisateurs**

### **🔐 Configuration Sécurisée**
```bash
# Utilisez des mots de passe forts
export SECRET_KEY=$(openssl rand -hex 32)

# Limitez l'accès réseau
# Utilisez HTTPS en production
export FLASK_ENV=production

# Mettez à jour régulièrement
docker compose pull
```

### **🛡️ Déploiement Sécurisé**
- **Firewall** : Limitez l'accès aux ports nécessaires
- **Updates** : Maintenez Docker et les dépendances à jour
- **Monitoring** : Surveillez les logs d'accès
- **Backups** : Chiffrez les sauvegardes de données

---

## 🆘 **En Cas d'Incident**

### **Réponse Immédiate**
1. **Isoler** le système affecté
2. **Évaluer** l'impact et les données concernées
3. **Notifier** l'équipe sécurité : alicechabaux@gmail.com
4. **Documenter** l'incident pour analyse

### **Communication**
- **Utilisateurs** : Notification transparente des incidents majeurs
- **Correctifs** : Publication rapide des patchs de sécurité
- **Post-mortem** : Analyse publique des leçons apprises

---

## 🔒 **Développement Sécurisé**

### **Standards de Code**
- ✅ **Validation entrées** : Toujours valider côté serveur
- ✅ **Principe moindre privilège** : Accès minimal nécessaire
- ✅ **Logs sécurisés** : Pas de données sensibles dans les logs
- ✅ **Tests sécurité** : Intégrés dans la CI/CD

### **Review de Sécurité**
Chaque Pull Request majeure fait l'objet d'une review sécurité incluant :
- Analyse des nouveaux endpoints
- Validation des permissions
- Test des inputs malveillants
- Vérification des dépendances

---

## 📞 **Contact et Support**

**Équipe Sécurité :**
- Alice Chabaux - Créatrice et Lead Developer
- Email : alicechabaux@gmail.com
- GitHub Issues : Pour rapports publics non-sensibles

**Temps de Réponse :**
- **Critique** : 24h
- **Élevé** : 48h  
- **Moyen** : 72h
- **Faible** : 1 semaine

---

*Dernière mise à jour : Septembre 2025*  
*Version 4.1.0 - Politique en vigueur*