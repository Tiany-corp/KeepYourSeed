// load dot env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Erreur: Les variables d'environnement Supabase ne sont pas définies !");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USER_ID = 'e44442ff-afdc-4cfc-be05-cf25f319d61c';

// Liste de titres bidons pour que ça ait l'air naturel
const titles = [
    "Rappel course", "Idée projet startup", "Chanson sous la douche",
    "Note pour demain", "Bruit bizarre de la voiture", "Pensée philosophique",
    "Liste de tâches", "Oubli réunion", "Refrain qui reste en tête",
    "Discussion avec Marc", "Conférence MMI", "Conseil investissement",
    "Rêve étrange", "Pitch ascenseur", "Message pour maman",
    "Anecdote drôle", "Réflexion perso", "Avis sur le film",
    "Recette de pâtes", "Mot de passe oral (chut)", "Sujet de mémoire",
    "Podcast idée", "Répétition discours", "Note vocale rapide", "Dernier test"
];

// Liens de sons libres de droit pour éviter d'avoir de vrais fichiers dans le bucket (on simule que c'est là)
const audioLinks = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
];

const generateDummyData = () => {
    const records = [];

    for (let i = 0; i < 25; i++) {
        // On génère des dates réparties sur l'année dernière pour avoir une vraie diversité
        const randomDaysAgo = Math.floor(Math.random() * 365);
        const date = new Date();
        date.setDate(date.getDate() - randomDaysAgo);

        records.push({
            user_id: USER_ID,
            title: titles[i % titles.length],
            // Pour tester la lecture on met de vrais url externes au lieu de chemins internes
            // car le getSignedUrl échouera si on met des chemins internes n'existant pas
            audio_url: audioLinks[i % audioLinks.length],
            duration_seconds: Math.floor(Math.random() * 120) + 10, // 10s à 130s
            created_at: date.toISOString()
        });
    }

    return records;
};

async function insertDummies() {
    console.log('⏳ Génération des 25 enregistrements...');
    const dataToInsert = generateDummyData();

    console.log(`📡 Insertion dans Supabase pour l'utilisateur ${USER_ID}...`);
    const { data, error } = await supabase
        .from('recordings')
        .insert(dataToInsert);

    if (error) {
        console.error("❌ Erreur lors de l'insertion :", error);
    } else {
        console.log("✅ Les 25 fichiers vocaux ont été injectés avec succès !");
    }
}

insertDummies();
