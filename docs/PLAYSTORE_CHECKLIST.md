# 📋 Checklist Publication Google Play Store — KeepYourSeed

*Dernière mise à jour : Octobre 2026*

---

## 1. 🔧 Configuration Technique (app.json / eas.json)

| Élément | Statut | Notes |
|---------|--------|-------|
| `package` Android défini | ✅ | `com.tianyr.KeepYourSeed` |
| `version` définie | ✅ | `1.0.0` |
| `icon` défini | ✅ | `./assets/oragnicKYS.png` |
| `adaptiveIcon` configuré | ✅ | `foregroundImage` + `backgroundColor` |
| Permissions micro | ✅ | `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` |
| `eas.json` profil production | ✅ | `autoIncrement: true` |
| Build APK/AAB production | ❌ À faire | `eas build --platform android --profile production` |

---

## 2. 📜 Documents Légaux (Obligatoire Play Store)

| Document | Statut | Notes |
|----------|--------|-------|
| Politique de Confidentialité (Privacy Policy) | ✅ Rédigé | Dans `docs/LEGAL.md` |
| CGU (Terms of Service) | ✅ Rédigé | Dans `docs/LEGAL.md` + `screens/TermsScreen.js` |
| **URL publique Privacy Policy** | ❌ À faire | Google exige une URL accessible publiquement (GitHub Pages, site web, etc.) |
| Mentions légales complètes | ⚠️ Incomplet | Remplir `[Ton Nom/Prénom]` et `[Ton Email de contact]` dans LEGAL.md |

---

## 3. 🗑️ Suppression de compte + données (Obligatoire depuis 2023)

| Élément | Statut | Notes |
|---------|--------|-------|
| Bouton suppression compte dans l'app | ✅ | Dans `components/SettingsDrawer.js` |
| Suppression des fichiers cloud (bucket) | ✅ | `emptyAudiosBucket()` dans `services/cloud.js` |
| Suppression du compte auth (Supabase) | ✅ | RPC `delete_my_account` |
| Option vider le stockage local | ✅ | Disponible dans les paramètres |
| Confirmation avant suppression | ✅ | Alert avec confirmation |

---

## 4. 🧪 Phase de Test (Obligatoire Play Store)

| Élément | Statut | Notes |
|---------|--------|-------|
| Test fermé (Closed Testing) | ❌ Requis | 20 testeurs minimum, 14 jours consécutifs |
| Questionnaire IARC | ❌ À remplir | Classification du contenu dans la Play Console |

### Comment lancer les tests ?
1. Créer un **test fermé** (Closed Testing track) sur la Play Console
2. Inviter 20 personnes via email
3. Ils doivent **accepter l'invitation** ET **installer l'app**
4. Attendre 14 jours
5. Demander l'accès Production

---

## 5. 🖼️ Fiches Play Store (Store Listing)

| Élément | Statut | Format requis |
|---------|--------|---------------|
| Nom de l'app | ✅ | « KeepYourSeed » (max 30 caractères) |
| Description courte | ❌ À rédiger | Max 80 caractères |
| Description longue | ❌ À rédiger | Max 4000 caractères |
| Icône Play Store | ❌ À préparer | 512×512 px, PNG, 32 bits, pas de transparence |
| Feature Graphic | ❌ À créer | 1024×500 px, PNG/JPEG |
| Screenshots (min 2) | ❌ À capturer | Min 320px, max 3840px, JPEG/PNG |
| Catégorie | ❌ À choisir | Suggestion : Lifestyle ou Productivité |

---

## 6. 💰 Compte Google Play Developer

| Élément | Statut | Notes |
|---------|--------|-------|
| Compte développeur Google Play | ❓ | Frais uniques de 25$ |
| Coordonnées développeur remplies | ❓ | Nom, email, téléphone, adresse |

---

## 7. 🏗️ Build de Production

```bash
eas build --platform android --profile production
```

Le Play Store exige un **AAB** (Android App Bundle), pas un APK.

---

## 📝 Plan d'action par priorité

1. ✏️ Remplir les infos manquantes dans `docs/LEGAL.md` (nom, email)
2. 🌐 Héberger la Privacy Policy en ligne (GitHub Pages)
3. 🖼️ Préparer l'icône 512×512 sans transparence
4. 📱 Créer/vérifier le compte développeur Google Play (25$)
5. 🧪 Lancer le test fermé avec 20 testeurs pendant 14 jours
6. ✍️ Rédiger les descriptions (courte + longue)
7. 📸 Prendre les screenshots de l'app
8. 🎨 Créer la Feature Graphic (1024×500)
9. 📋 Remplir le questionnaire IARC
10. 🏗️ Lancer le build production
11. 📤 Upload l'AAB sur la Play Console
12. ✅ Soumettre pour review Google
