// @ts-nocheck
/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Gestion du CORS pour les appels depuis le navigateur/app
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialiser Supabase pour se connecter à la base de données
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );

    // 2. Récupérer l'utilisateur qui fait la requête
    const jwt = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User Auth Error:", userError);
      throw new Error("Non autorisé ou jeton invalide");
    }

    // 3. Chercher le Push Token de cet utilisateur dans la table
    const { data: pushDataArray, error: dbError } = await supabaseClient
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', user.id)
      .like('expo_push_token', 'ExponentPushToken%') // Ignore error messages saved as tokens
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError || !pushDataArray || pushDataArray.length === 0) {
      throw new Error("Aucun Push Token valide trouvé pour cet utilisateur");
    }

    const pushData = pushDataArray[0];

    // 4. Construire le message pour Expo
    const expoMessage = {
      to: pushData.expo_push_token,
      sound: 'default',
      title: '🚀 Push Distant Réussi !',
      body: 'Ton serveur Supabase vient de te réveiller.',
      data: { info: 'Depuis Edge Function CLI' },
    };

    // 5. Envoyer la requête à l'API publique d'Expo
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoMessage),
    });

    const expoResult = await expoResponse.json();

    return new Response(JSON.stringify({ success: true, expo: expoResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
