# Troubleshooting - KeepYourSeed

Ce document répertorie les problèmes techniques rencontrés lors du développement et leurs solutions.

## 🔐 Authentification Google (OAuth)

### Problème : Erreur "Failed to launch 'exp://...'" sur navigateur Web
**Date** : 26 Avril 2026
**Symptôme** : Lors d'une tentative de connexion Google sur PC (Web), après avoir choisi le compte Google, le navigateur essaie d'ouvrir une URL commençant par `exp://192.168.x.x:8081` au lieu de revenir sur l'application Web. Cela provoque un chargement infini ou une erreur de protocole.

#### 🚩 Cause Racine
Le paramètre `redirectTo` envoyé à Supabase était mal détecté ou mal formaté pour l'environnement Web. 
- Si l'app envoie une URL `exp://` (propre à Expo Go), Supabase redirige vers ce protocole que le navigateur PC ne sait pas gérer.
- Si l'app envoie une URL avec un `pathname` (ex: `/kys-web-app/`) qui n'est pas explicitement autorisé dans le dashboard Supabase, Supabase fait un "fallback" sur le **Site URL** configuré. Si ce Site URL est lui-même une adresse `exp://`, l'erreur survient.

#### ✅ Solution Appliquée
1.  **Code (`services/googleAuth.js`)** : 
    - Sécurisation de la détection du mode Web via `typeof window !== 'undefined'`.
    - Forçage du `redirectTo` vers la racine du domaine (`window.location.origin + '/'`) pour garantir la compatibilité avec le **Site URL** de Supabase.
2.  **Configuration Supabase (Dashboard)** :
    - Positionner le **Site URL** sur `http://localhost:8081` (ou l'URL de production).
    - Ajouter les URLs de redirection autorisées :
        - `http://localhost:8081/`
        - `http://localhost:3000/`
        - `keepyourseed://auth-callback` (pour le build natif Android/iOS)

---

## 📁 Stockage & Synchronisation

*(Ajouter ici les futurs problèmes de synchronisation ou de cache audio)*
